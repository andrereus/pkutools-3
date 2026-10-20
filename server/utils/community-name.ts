import { getAdminDatabase } from './firebase-admin'

// Community names are unique. Each name in use is claimed under its key in
// `communityNameKeys`, so a check and a claim happen in one step.

/** The form two names are compared in: case, spaces and punctuation do not count. */
export const communityNameKey = (name: string): string =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')

// Names that would pass for the app itself, whose own posts carry a badge.
const RESERVED_KEYS = ['admin', 'administrator', 'moderator']

export const isReservedNameKey = (key: string): boolean =>
  key.includes('pkutools') || RESERVED_KEYS.includes(key)

/** The key of the account's current name, if it has one. */
export async function currentNameKey(userId: string): Promise<string | null> {
  const name = (
    await getAdminDatabase().ref(`communityProfiles/${userId}/nickname`).once('value')
  ).val()
  return typeof name === 'string' ? communityNameKey(name) : null
}

/** Claims a name key for the account. False when another account holds it. */
export async function claimNameKey(userId: string, key: string): Promise<boolean> {
  const result = await getAdminDatabase()
    .ref(`communityNameKeys/${key}`)
    .transaction((owner: unknown) => (owner === null || owner === userId ? userId : undefined))
  return result.committed
}

/** Adds releasing a name key to an existing atomic update, if the account holds it. */
export async function queueNameKeyRelease(
  writes: Record<string, unknown>,
  userId: string,
  key: string | null
): Promise<void> {
  if (!key) return
  const owner = (await getAdminDatabase().ref(`communityNameKeys/${key}`).once('value')).val()
  if (owner === userId) writes[`communityNameKeys/${key}`] = null
}
