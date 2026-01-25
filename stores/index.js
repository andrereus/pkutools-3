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
import { getDatabase, ref, onValue } from 'firebase/database'
import { defineStore } from 'pinia'

const defaultSettings = {
  maxPhe: null,
  labUnit: 'mgdl',
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
    communityFoods: [],
    communityVotes: {},
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
          this.initRef()
        } else {
          this.unsubscribeAll()
          this.user = null
        }
      })
    },
    async signOut() {
      const auth = getAuth()
      try {
        await signOut(auth)
        this.unsubscribeAll()
        this.user = null
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
      const db = getDatabase()
      const userId = this.user.id
      const initialState = {
        pheDiary: [],
        labValues: [],
        ownFood: [],
        settings: { ...defaultSettings },
        communityVotes: {}
      }

      const bindRef = (key, dbRef) => {
        const unsubscribe = onValue(dbRef, (snapshot) => {
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
        })
        this.unsubscribeFunctions[key] = unsubscribe
      }

      bindRef('pheDiary', ref(db, `${userId}/pheDiary`))
      bindRef('labValues', ref(db, `${userId}/labValues`))
      bindRef('ownFood', ref(db, `${userId}/ownFood`))
      bindRef('settings', ref(db, `${userId}/settings`))
      bindRef('communityVotes', ref(db, `${userId}/communityVotes`))

      // Community foods - global listener (not user-specific)
      const communityFoodsUnsubscribe = onValue(ref(db, 'communityFoods'), (snapshot) => {
        const data = snapshot.val()
        if (data && typeof data === 'object') {
          this.communityFoods = Object.entries(data).map(([key, value]) => ({ ...value, '.key': key }))
        } else {
          this.communityFoods = []
        }
      })
      this.unsubscribeFunctions['communityFoods'] = communityFoodsUnsubscribe
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
