import { getAdminDatabase } from './firebase-admin'

// Community names are unique: no two accounts hold names with the same key.

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

/**
 * Whether another account already uses a name with this key. Keys are worked
 * out from the stored names each time, so a stricter comparison applies to
 * every existing name at once.
 */
export async function isNameKeyTaken(userId: string, key: string): Promise<boolean> {
  const profiles = ((await getAdminDatabase().ref('communityProfiles').once('value')).val() ??
    {}) as Record<string, { communityName?: unknown } | null>
  return Object.entries(profiles).some(
    ([holderId, profile]) =>
      holderId !== userId &&
      typeof profile?.communityName === 'string' &&
      communityNameKey(profile.communityName) === key
  )
}
