/**
 * Client-side community food configuration constants
 * Must match server-side constants in server/utils/community-food.ts
 */

// Score threshold below which community foods are automatically hidden
export const COMMUNITY_FOOD_HIDE_THRESHOLD = -3

/**
 * Check if a community food should be hidden based on its score
 * @param score - The food's score (likes - dislikes)
 * @returns true if the food should be hidden
 */
export function isCommunityFoodHidden(score: number): boolean {
  return score < COMMUNITY_FOOD_HIDE_THRESHOLD
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
