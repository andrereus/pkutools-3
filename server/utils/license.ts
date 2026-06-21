import { getAdminDatabase } from './firebase-admin'

async function readLicenseKey(userId: string): Promise<string | undefined> {
  const db = getAdminDatabase()
  const snapshot = await db.ref(`/${userId}/settings`).once('value')
  return (snapshot.val() || {}).license
}

/**
 * Maps a license key to entitlement flags. Pure (no DB read), so callers that
 * already hold the user's settings can derive flags without re-reading.
 * Single source of truth for what each license key grants.
 */
export function licenseFlags(licenseKey: string | null | undefined): {
  premium: boolean
  premiumAI: boolean
} {
  const config = useRuntimeConfig()
  // Fail closed: only match against a configured, non-empty key. Otherwise an
  // unset env var would make `undefined === undefined` true and grant premium
  // to every user (including those with no license at all).
  const matches = (configured: string | undefined) =>
    typeof configured === 'string' && configured.length > 0 && licenseKey === configured
  return {
    premium: matches(config.pkutoolsLicenseKey) || matches(config.pkutoolsLicenseKey2),
    premiumAI: matches(config.pkutoolsLicenseKey2)
  }
}

/**
 * Checks if a user has premium license status
 * @param userId - The user's Firebase UID
 */
export async function checkPremiumStatus(userId: string): Promise<boolean> {
  return licenseFlags(await readLicenseKey(userId)).premium
}

/**
 * Checks if a user has premium+AI license status
 * @param userId - The user's Firebase UID
 */
export async function checkPremiumAIStatus(userId: string): Promise<boolean> {
  return licenseFlags(await readLicenseKey(userId)).premiumAI
}
