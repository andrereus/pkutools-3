import { initializeApp, getApps } from 'firebase/app'

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

  return {
    provide: {
      firebaseApp: app
    }
  }
})
