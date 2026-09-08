export const MAX_COMMUNITY_FOOD_COMMENTS = 100

/**
 * Adds the comment-side deletion for a community food to an existing atomic
 * root update. Comments and edit history disappear when the food is withdrawn
 * or deleted, while ordinary content edits preserve the whole thread.
 */
export function queueCommunityFoodCommentRemoval(
  communityFoodKey: string,
  writes: Record<string, unknown>
): void {
  writes[`communityFoodComments/${communityFoodKey}`] = null
}
