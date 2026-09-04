export const MAX_COMMUNITY_FOOD_COMMENTS = 100

/**
 * Adds the comment-side deletion for a community food to an existing atomic
 * root update. Public comments must disappear with the food, or a later write
 * could leave feedback referring to a version that is no longer visible.
 */
export function queueCommunityFoodCommentRemoval(
  communityFoodKey: string,
  writes: Record<string, unknown>
): void {
  writes[`communityFoodComments/${communityFoodKey}`] = null
}
