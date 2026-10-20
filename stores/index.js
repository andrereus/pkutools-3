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
import {
  getDatabase,
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
  equalTo,
  startAt,
  endAt
} from 'firebase/database'
import { defineStore } from 'pinia'
import { languageBounds } from '#shared/utils/community-post'

// How many of the newest posts in the reader's language load at first. News
// asks for more as the reader loads more.
export const FEED_POSTS_PAGE = 20

const FOLLOWED_POST_LISTENER = 'followedPost:'

// A database key: no path separators or characters Firebase refuses.
const DATABASE_KEY = /^[^.#$[\]/]{1,128}$/

export const toList = (data) =>
  data && typeof data === 'object'
    ? Object.entries(data).map(([key, value]) => ({ ...value, '.key': key }))
    : []

const without = (record, key) =>
  Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key))

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
    // The newest posts in the reader's language, as many as `feedQuery` asks for.
    communityPosts: [],
    feedQuery: { language: null, limit: FEED_POSTS_PAGE },
    // False while the feed waits for the snapshot of its current query.
    feedLoaded: false,
    // The reader's own posts, and single posts followed whatever their age:
    // those they commented on, and the one the current link points to.
    // Notifications and links always find their post this way.
    ownCommunityPosts: [],
    followedCommunityPosts: {},
    linkedPostId: null,
    // Opt-in community names by user ID, shown on posts and comments.
    communityNames: {},
    // When the reader last opened the comments of their own foods and posts,
    // by key, so a read comment no longer counts as a notification.
    communityReads: { foods: {}, posts: {} },
    // Others' foods and posts the reader commented on, with their last comment
    // there, so later comments by someone else can notify them.
    communityThreads: { foods: {}, posts: {} },
    // What the account has seen in News, for the blue dots and the bell.
    newsSeen: { loaded: false, lastReadAt: null, lastSeenRevision: null },
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

      this.bindFeedPosts(db)

      this.unsubscribeFunctions['ownCommunityPosts'] = onValue(
        query(ref(db, 'communityPosts'), orderByChild('authorId'), equalTo(userId)),
        (snapshot) => {
          this.ownCommunityPosts = toList(snapshot.val())
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

      this.unsubscribeFunctions['communityReads'] = onValue(
        ref(db, `${userId}/communityReads`),
        (snapshot) => {
          const data = snapshot.val()
          this.communityReads = {
            foods: data?.foods && typeof data.foods === 'object' ? data.foods : {},
            posts: data?.posts && typeof data.posts === 'object' ? data.posts : {}
          }
        }
      )

      this.unsubscribeFunctions['communityThreads'] = onValue(
        ref(db, `${userId}/communityThreads`),
        (snapshot) => {
          const data = snapshot.val()
          this.communityThreads = {
            foods: data?.foods && typeof data.foods === 'object' ? data.foods : {},
            posts: data?.posts && typeof data.posts === 'object' ? data.posts : {}
          }
          this.syncFollowedPosts(db)
        }
      )

      const marker = (value) => (Number.isSafeInteger(value) && value > 0 ? value : null)
      this.unsubscribeFunctions['newsSeen'] = onValue(
        ref(db, `${userId}/newsSeen`),
        (snapshot) => {
          const data = snapshot.val()
          this.newsSeen = {
            loaded: true,
            lastReadAt: marker(data?.lastReadAt),
            lastSeenRevision: marker(data?.lastSeenRevision)
          }
        },
        () => {
          // The browser's marker stands in, as for a signed-out visitor.
          this.newsSeen = { loaded: true, lastReadAt: null, lastSeenRevision: null }
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
    // The newest posts in one language. Rebound when the language or the
    // number asked for changes.
    // Only a signed-in reader has a feed. The database is reached after that
    // check: during server rendering nobody is signed in and Firebase does not
    // exist.
    bindFeedPosts(db) {
      this.unsubscribeFunctions['communityPosts']?.()
      delete this.unsubscribeFunctions['communityPosts']
      const { language, limit } = this.feedQuery
      this.feedLoaded = false
      if (!this.user || !language) return
      db ??= getDatabase()
      const bounds = languageBounds(language)
      this.unsubscribeFunctions['communityPosts'] = onValue(
        query(
          ref(db, 'communityPosts'),
          orderByChild('languageCreatedAt'),
          startAt(bounds.start),
          endAt(bounds.end),
          limitToLast(limit)
        ),
        (snapshot) => {
          this.communityPosts = toList(snapshot.val())
          this.feedLoaded = true
        },
        () => {
          // Nothing more arrives; the page stops waiting for it.
          this.feedLoaded = true
        }
      )
    },
    setFeedQuery(language, limit = this.feedQuery.limit) {
      if (this.feedQuery.language === language && this.feedQuery.limit === limit) return
      if (this.feedQuery.language !== language) this.communityPosts = []
      this.feedQuery = { language, limit }
      this.bindFeedPosts()
    },
    // Follows the post the current link points to, so it can be shown wherever
    // it is. A new link replaces the previous one.
    followLinkedPost(postId) {
      if (typeof postId !== 'string' || !DATABASE_KEY.test(postId)) return
      if (this.linkedPostId === postId) return
      this.linkedPostId = postId
      this.syncFollowedPosts()
    },
    // One listener per followed post, kept in step with the posts the reader
    // commented on and the ones a link asked for.
    syncFollowedPosts(db) {
      if (!this.user) return
      db ??= getDatabase()
      const postIds = [
        ...new Set([
          ...Object.keys(this.communityThreads.posts).filter((postId) => DATABASE_KEY.test(postId)),
          ...(this.linkedPostId ? [this.linkedPostId] : [])
        ])
      ]
      for (const name of Object.keys(this.unsubscribeFunctions)) {
        if (!name.startsWith(FOLLOWED_POST_LISTENER)) continue
        const postId = name.slice(FOLLOWED_POST_LISTENER.length)
        if (postIds.includes(postId)) continue
        this.unsubscribeFunctions[name]()
        delete this.unsubscribeFunctions[name]
        this.followedCommunityPosts = without(this.followedCommunityPosts, postId)
      }
      for (const postId of postIds) {
        const name = `${FOLLOWED_POST_LISTENER}${postId}`
        if (this.unsubscribeFunctions[name]) continue
        this.unsubscribeFunctions[name] = onValue(
          ref(db, `communityPosts/${postId}`),
          (snapshot) => {
            const data = snapshot.val()
            const others = without(this.followedCommunityPosts, postId)
            this.followedCommunityPosts =
              data && typeof data === 'object'
                ? { ...others, [postId]: { ...data, '.key': postId } }
                : others
          }
        )
      }
    },
    resetUserData() {
      this.pheDiary = []
      this.labValues = []
      this.ownFood = []
      this.communityFoods = []
      this.communityPosts = []
      this.ownCommunityPosts = []
      this.followedCommunityPosts = {}
      this.linkedPostId = null
      this.feedLoaded = false
      this.communityNames = {}
      this.communityReads = { foods: {}, posts: {} }
      this.communityThreads = { foods: {}, posts: {} }
      this.newsSeen = { loaded: false, lastReadAt: null, lastSeenRevision: null }
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
