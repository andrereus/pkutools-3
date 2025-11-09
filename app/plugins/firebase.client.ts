import { initializeApp, getApps } from 'firebase/app'
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
