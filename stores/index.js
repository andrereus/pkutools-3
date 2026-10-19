import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { getDatabase, ref, onValue, query, orderByChild, limitToLast } from 'firebase/database'
import { defineStore } from 'pinia'

// The newest posts across all languages. Older ones drop out of the feed.
export const COMMUNITY_POSTS_LIMIT = 200

const defaultSettings = {
  maxPhe: null,
  maxKcal: null,
  bloodPheMin: null,
  bloodPheMax: null,
  bloodTyrMin: null,
  bloodTyrMax: null,
  labUnit: 'mgdl',
  progressStyle: 'circles',
  preferredTool: 'food-search',
  license: null,
  healthDataConsent: false,
  healthDataConsentDate: null,
  healthDataConsentHistory: [],
  emailConsent: false,
  emailConsentDate: null,
  emailConsentHistory: [],
  gettingStartedCompleted: false,
  estimationCount: 0,
  estimationDate: null
}

export const useStore = defineStore('main', {
  state: () => ({
    user: null,
    pheDiary: [],
    labValues: [],
    ownFood: [],
    settings: { ...defaultSettings },
    // False until a settings snapshot has come back from Firebase. Anything
    // that branches on settings (onboarding checks, post-sign-in routing) must
    // wait for this, otherwise it decides against the local defaults.
    settingsLoaded: false,
    // False until Firebase has reported the restored sign-in state once. Until
    // then user is null for signed-in users too, so views that differ by
    // sign-in state wait for this instead of showing the signed-out version.
    authChecked: false,
    // False until the first snapshot of each list, so an empty list can be told
    // apart from one that hasn't loaded yet.
    pheDiaryLoaded: false,
    labValuesLoaded: false,
    ownFoodLoaded: false,
    // True once the user data listeners couldn't be set up or one was refused.
    // Views stop waiting then and
    // show what they have; the loaded flags stay false, so nothing that checks
    // settingsLoaded decides against the local defaults.
    userDataFailed: false,
    communityFoods: [],
    communityPosts: [],
    // Opt-in community names by user ID, shown on posts and comments.
    communityNames: {},
    // Accounts whose posts and comments show as PKU Tools, by user ID.
    adminIds: {},
    // Only decides whether admin pages are offered; the server checks again.
    // Null until the admin list has loaded.
    isAdmin: null,
    unsubscribeFunctions: {}
  }),
  actions: {
    async signInGoogle() {
      const auth = getAuth()
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      this.user = {
        id: result.user.uid,
        name: result.user.displayName,
        email: result.user.email,
        photoUrl: result.user.photoURL
      }
      this.initRef()
    },
    async registerWithEmail(email, password, name) {
      const auth = getAuth()
      auth.useDeviceLanguage()
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(result.user, {
        displayName: name
      })
      this.user = {
        id: result.user.uid,
        name: result.user.displayName,
        email: result.user.email,
        photoUrl: result.user.photoURL
      }
      this.initRef()
    },
    async signInWithEmail(email, password) {
      const auth = getAuth()
      auth.useDeviceLanguage()
      const result = await signInWithEmailAndPassword(auth, email, password)
      this.user = {
        id: result.user.uid,
        name: result.user.displayName,
        email: result.user.email,
        photoUrl: result.user.photoURL
      }
      this.initRef()
    },
    autoSignIn(user) {
      this.user = {
        id: user.uid,
        name: user.displayName,
        email: user.email,
        photoUrl: user.photoURL
      }
      // Don't check onboarding here - it will be checked in initRef
    },
    checkAuthState() {
      const auth = getAuth()
      onAuthStateChanged(auth, (user) => {
        if (user) {
          this.autoSignIn(user)
          try {
            this.initRef()
          } catch (error) {
            console.error('Failed to load user data:', error)
            this.userDataFailed = true
          }
        } else {
          this.unsubscribeAll()
          this.user = null
          this.resetUserData()
        }
        this.authChecked = true
      })
    },
    async signOut() {
      const auth = getAuth()
      try {
        await signOut(auth)
        this.unsubscribeAll()
        this.user = null
        this.resetUserData()
      } catch (error) {
        console.error(error)
      }
    },
    async resetPassword(email) {
      const auth = getAuth()
      auth.useDeviceLanguage()
      await sendPasswordResetEmail(auth, email)
    },
    initRef() {
      // Tear down any existing listeners before re-binding. initRef is called
      // both by the sign-in actions and by the onAuthStateChanged handler, so
      // without this every login would register a second set of listeners and
      // orphan the first (leak + duplicate state writes).
      this.unsubscribeAll()
      // Drop the previous account's data before binding the new listeners, so
      // nothing of theirs is readable in the window before the first snapshot.
      this.resetUserData()

      const db = getDatabase()
      const userId = this.user.id
      const initialState = {
        pheDiary: [],
        labValues: [],
        ownFood: [],
        settings: { ...defaultSettings }
      }

      const bindRef = (key, dbRef) => {
        const unsubscribe = onValue(
          dbRef,
          (snapshot) => {
            const data = snapshot.val()
            const isInitiallyArray = Array.isArray(initialState[key])

            if (data && typeof data === 'object') {
              if (isInitiallyArray) {
                this[key] = Object.entries(data).map(([key, value]) => ({ ...value, '.key': key }))
              } else if (key === 'settings') {
                this[key] = { ...defaultSettings, ...data }
              } else {
                this[key] = data
              }
            } else {
              if (isInitiallyArray) {
                this[key] = []
              } else if (key === 'settings') {
                this[key] = { ...defaultSettings }
              } else {
                this[key] = {}
              }
            }

            this[`${key}Loaded`] = true
          },
          (error) => {
            console.error(`Failed to load ${key}:`, error)
            this.userDataFailed = true
          }
        )
        this.unsubscribeFunctions[key] = unsubscribe
      }

      bindRef('pheDiary', ref(db, `${userId}/pheDiary`))
      bindRef('labValues', ref(db, `${userId}/labValues`))
      bindRef('ownFood', ref(db, `${userId}/ownFood`))
      bindRef('settings', ref(db, `${userId}/settings`))

      // Community foods - global listener (not user-specific)
      const communityFoodsUnsubscribe = onValue(ref(db, 'communityFoods'), (snapshot) => {
        const data = snapshot.val()
        if (data && typeof data === 'object') {
          this.communityFoods = Object.entries(data).map(([key, value]) => ({
            ...value,
            '.key': key
          }))
        } else {
          this.communityFoods = []
        }
      })
      this.unsubscribeFunctions['communityFoods'] = communityFoodsUnsubscribe

      this.unsubscribeFunctions['communityPosts'] = onValue(
        query(
          ref(db, 'communityPosts'),
          orderByChild('createdAt'),
          limitToLast(COMMUNITY_POSTS_LIMIT)
        ),
        (snapshot) => {
          const data = snapshot.val()
          this.communityPosts =
            data && typeof data === 'object'
              ? Object.entries(data).map(([key, value]) => ({ ...value, '.key': key }))
              : []
        }
      )

      this.unsubscribeFunctions['communityProfiles'] = onValue(
        ref(db, 'communityProfiles'),
        (snapshot) => {
          const data = snapshot.val()
          this.communityNames = Object.fromEntries(
            Object.entries(data && typeof data === 'object' ? data : {}).flatMap(
              ([userId, profile]) =>
                typeof profile?.nickname === 'string' && profile.nickname.trim()
                  ? [[userId, profile.nickname]]
                  : []
            )
          )
        }
      )

      this.unsubscribeFunctions['admins'] = onValue(
        ref(db, 'admins'),
        (snapshot) => {
          const data = snapshot.val()
          this.adminIds = Object.fromEntries(
            Object.entries(data && typeof data === 'object' ? data : {}).filter(
              ([, value]) => value === true
            )
          )
          this.isAdmin = this.adminIds[userId] === true
        },
        () => {
          this.adminIds = {}
          this.isAdmin = false
        }
      )
    },
    resetUserData() {
      this.pheDiary = []
      this.labValues = []
      this.ownFood = []
      this.communityFoods = []
      this.communityPosts = []
      this.communityNames = {}
      this.adminIds = {}
      this.isAdmin = null
      this.settings = { ...defaultSettings }
      this.settingsLoaded = false
      this.pheDiaryLoaded = false
      this.labValuesLoaded = false
      this.ownFoodLoaded = false
      this.userDataFailed = false
    },
    unsubscribeAll() {
      Object.values(this.unsubscribeFunctions).forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe()
        }
      })
      this.unsubscribeFunctions = {}
    }
  }
})
