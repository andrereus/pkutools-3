import { getAdminDatabase } from './firebase-admin'

/**
 * Community food configuration constants
 */

// Community foods are hidden at this score or below (three net dislikes).
export const COMMUNITY_FOOD_HIDE_THRESHOLD = -3

/**
 * Check if a community food should be hidden based on its score
 * @param score - The food's score (likes - dislikes)
 * @returns true if the food should be hidden
 */
export function isCommunityFoodHidden(score: number): boolean {
  return score <= COMMUNITY_FOOD_HIDE_THRESHOLD
}

// The origins whose values may be published to the community. Each of them is
// the user's own calculation from something they can point at: a number they
// typed, the protein a scanned product declares, or the protein printed on a
// photographed label. What is left out is deliberate — 'ai-estimate' is a guess
// rather than a reading, and the food-search origins ('bls', 'usda',
// 'own-food', 'community') are already searchable for everyone.
export const SHAREABLE_FOOD_SOURCES = ['manual', 'barcode', 'ai-label'] as const

/**
 * Check whether a food's values may be shared with the community
 * @param source - The food's stored source, absent on records written before
 *                 provenance existed (those stay shareable)
 */
export function isShareableSource(source: string | null | undefined): boolean {
  if (source === null || source === undefined || source === '') return true
  return (SHAREABLE_FOOD_SOURCES as readonly string[]).includes(source)
}

const isDatabaseKey = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !/[.#$[\]/]/.test(value)

/**
 * The path of the contributor's own food behind a community food, when that
 * own food exists and points back to it. Only a link both records agree on is
 * followed, so malformed data cannot reach another account's food.
 */
export async function linkedOwnFoodPath(
  food: Record<string, unknown>,
  communityFoodKey: string
): Promise<string | null> {
  if (!isDatabaseKey(food.contributorId) || !isDatabaseKey(food.ownFoodKey)) return null
  const path = `${food.contributorId}/ownFood/${food.ownFoodKey}`
  const ownFood = (await getAdminDatabase().ref(path).once('value')).val() as Record<
    string,
    unknown
  > | null
  return ownFood?.communityKey === communityFoodKey ? path : null
}
