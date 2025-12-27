import { getAdminDatabase } from './firebase-admin'

/**
 * Checks if a user has premium license status
 * @param userId - The user's Firebase UID
 * @returns Promise<boolean> - True if user has premium license
 */
export async function checkPremiumStatus(userId: string): Promise<boolean> {
  const db = getAdminDatabase()
  const settingsRef = db.ref(`/${userId}/settings`)
  const settingsSnapshot = await settingsRef.once('value')
  const settings = settingsSnapshot.val() || {}

  const config = useRuntimeConfig()
  const licenseKey = settings.license
  return licenseKey === config.pkutoolsLicenseKey
}

