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
import { getDatabase, ref, onValue, update as dbUpdate } from 'firebase/database'
import { defineStore } from 'pinia'
import { formatISO } from 'date-fns'

const defaultSettings = {
  maxPhe: null,
  labUnit: 'mgdl',
  license: null,
  healthDataConsent: false,
  healthDataConsentDate: null,
  healthDataConsentHistory: [],
  emailConsent: false,
  emailConsentDate: null,
  emailConsentHistory: []
}

export const useStore = defineStore('main', {
  state: () => ({
    user: null,
    pheDiary: [],
    labValues: [],
    ownFood: [],
    settings: { ...defaultSettings },
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
        settings: { ...defaultSettings }
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
    },
    unsubscribeAll() {
      Object.values(this.unsubscribeFunctions).forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe()
        }
      })
      this.unsubscribeFunctions = {}
    },
    async updateHealthDataConsent(healthDataConsent, emailConsent = false) {
      if (!this.user) return false
      const db = getDatabase()
      const consentDate = formatISO(new Date(), { representation: 'date' })

      try {
        // Initialize history arrays if they don't exist (for existing users)
        if (!this.settings.healthDataConsentHistory) {
          this.settings.healthDataConsentHistory = []
        }
        if (!this.settings.emailConsentHistory) {
          this.settings.emailConsentHistory = []
        }

        // For existing users with consent but no history, create initial entry
        if (
          this.settings.healthDataConsent === true &&
          this.settings.healthDataConsentHistory.length === 0 &&
          this.settings.healthDataConsentDate
        ) {
          this.settings.healthDataConsentHistory.push({
            action: 'given',
            date: this.settings.healthDataConsentDate
          })
        }

        // Create history entries
        const healthConsentEntry = {
          action: healthDataConsent ? 'given' : 'revoked',
          date: consentDate
        }

        const emailConsentEntry = emailConsent
          ? {
              action: 'given',
              date: consentDate
            }
          : null

        // Update history arrays (keep last 10 entries)
        const newHealthHistory = [
          ...this.settings.healthDataConsentHistory,
          healthConsentEntry
        ].slice(-10)
        const newEmailHistory = emailConsentEntry
          ? [...this.settings.emailConsentHistory, emailConsentEntry].slice(-10)
          : this.settings.emailConsentHistory

        const updateData = healthDataConsent
          ? {
              healthDataConsent: true,
              healthDataConsentDate: consentDate,
              healthDataConsentHistory: newHealthHistory
            }
          : {
              healthDataConsent: false,
              healthDataConsentDate: consentDate,
              healthDataConsentHistory: newHealthHistory
            }

        if (emailConsent) {
          updateData.emailConsent = true
          updateData.emailConsentDate = consentDate
          updateData.emailConsentHistory = newEmailHistory
        }

        await dbUpdate(ref(db, `${this.user.id}/settings`), updateData)

        // Update local state
        this.settings.healthDataConsent = healthDataConsent
        this.settings.healthDataConsentDate = consentDate
        this.settings.healthDataConsentHistory = newHealthHistory

        if (emailConsent) {
          this.settings.emailConsent = true
          this.settings.emailConsentDate = consentDate
          this.settings.emailConsentHistory = newEmailHistory
        }

        return true
      } catch (error) {
        console.error('Error updating health data consent:', error)
        return false
      }
    },
    async updateEmailConsent(emailConsent) {
      if (!this.user) return false

      const db = getDatabase()
      const consentDate = formatISO(new Date(), { representation: 'date' })

      try {
        // Initialize history array if it doesn't exist (for existing users)
        if (!this.settings.emailConsentHistory) {
          this.settings.emailConsentHistory = []
        }

        // For existing users with email consent but no history, create initial entry
        if (
          this.settings.emailConsent === true &&
          this.settings.emailConsentHistory.length === 0 &&
          this.settings.emailConsentDate
        ) {
          this.settings.emailConsentHistory.push({
            action: 'given',
            date: this.settings.emailConsentDate
          })
        }

        // Create history entry
        const emailConsentEntry = {
          action: emailConsent ? 'given' : 'revoked',
          date: consentDate
        }

        // Update history array (keep last 10 entries)
        const newEmailHistory = [...this.settings.emailConsentHistory, emailConsentEntry].slice(-10)

        const updateData = emailConsent
          ? {
              emailConsent: true,
              emailConsentDate: consentDate,
              emailConsentHistory: newEmailHistory
            }
          : {
              emailConsent: false,
              emailConsentDate: null,
              emailConsentHistory: newEmailHistory
            }

        await dbUpdate(ref(db, `${this.user.id}/settings`), updateData)

        this.settings.emailConsent = emailConsent
        this.settings.emailConsentDate = emailConsent ? consentDate : null
        this.settings.emailConsentHistory = newEmailHistory
        return true
      } catch (error) {
        console.error('Error updating email consent:', error)
        return false
      }
    }
  }
})
