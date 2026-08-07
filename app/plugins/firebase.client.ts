import { initializeApp, getApps } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId,
    databaseURL: config.public.firebaseDatabaseURL
  }

  const apps = getApps()
  const app = apps.length ? apps[0] : initializeApp(firebaseConfig)

  const appCheckSiteKey = config.public.firebaseAppCheckSiteKey

  if (appCheckSiteKey) {
    if (import.meta.dev) {
      const debugGlobal = self as typeof self & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string
      }
      debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = true
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true
    })
  } else if (!import.meta.dev) {
    throw new Error('FIREBASE_APP_CHECK_SITE_KEY is not configured')
  }

  // Connect to emulators in development mode
  if (import.meta.dev) {
    const auth = getAuth(app)
    const db = getDatabase(app)

    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
    connectDatabaseEmulator(db, 'localhost', 9000)

    console.log('Connected to Firebase emulators')
  }

  return {
    provide: {
      firebaseApp: app
    }
  }
})
