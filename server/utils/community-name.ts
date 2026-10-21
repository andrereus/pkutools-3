import { getAdminDatabase } from './firebase-admin'

// Community names are unique. Each profile stores its name's comparison form
// as `nameKey`, so a name in use is found with one indexed query.

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

/** Whether another account already uses a name with this key. */
export async function isNameKeyTaken(userId: string, key: string): Promise<boolean> {
  const holders = (
    await getAdminDatabase()
      .ref('communityProfiles')
      .orderByChild('nameKey')
      .equalTo(key)
      .once('value')
  ).val() as Record<string, unknown> | null
  return Object.keys(holders ?? {}).some((holderId) => holderId !== userId)
}
