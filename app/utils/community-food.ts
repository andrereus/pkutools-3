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
