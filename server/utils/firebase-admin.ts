import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth'
import { getDatabase, type Database } from 'firebase-admin/database'

// Set emulator environment variables at module load time (before Firebase Admin SDK initializes)
// This ensures they're available when the SDK checks for them
if (process.env.NODE_ENV === 'development' || import.meta.dev) {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  }
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000'
  }
}

let adminApp: App | null = null
let adminAuth: Auth | null = null
let adminDatabase: Database | null = null

function initializeAdminApp(): App {
  if (adminApp) {
    return adminApp
  }

  const config = useRuntimeConfig()
  const apps = getApps()

  if (apps.length > 0) {
    adminApp = apps[0]
  } else {
    // Check if we're in development with emulators
    const isDev = process.env.NODE_ENV === 'development' || import.meta.dev

    if (isDev) {
      // Emulator environment variables are already set at module load time

      // For development with emulators, use default credentials
      adminApp = initializeApp(
        {
          projectId: config.public.firebaseProjectId,
          databaseURL: config.public.firebaseDatabaseURL
        },
        'admin'
      )
    } else {
      // For production, use service account credentials from environment variables
      const serviceAccount = {
        projectId: config.firebaseAdminProjectId || config.public.firebaseProjectId,
        clientEmail: config.firebaseAdminClientEmail,
        privateKey: config.firebaseAdminPrivateKey?.replace(/\\n/g, '\n')
      }

      if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
        throw new Error(
          'Firebase Admin credentials not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY environment variables.\n' +
            'Get these values from your Firebase service account JSON file:\n' +
            '- client_email → FIREBASE_ADMIN_CLIENT_EMAIL\n' +
            '- private_key → FIREBASE_ADMIN_PRIVATE_KEY (copy the entire value including BEGIN/END markers)'
        )
      }

      adminApp = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: config.public.firebaseDatabaseURL
      })
    }
  }

  return adminApp
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = initializeAdminApp()
    adminAuth = getAuth(app)
  }
  return adminAuth
}

export function getAdminDatabase(): Database {
  if (!adminDatabase) {
    const app = initializeAdminApp()
    adminDatabase = getDatabase(app)
  }
  return adminDatabase
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const auth = getAdminAuth()
  return await auth.verifyIdToken(token)
}
