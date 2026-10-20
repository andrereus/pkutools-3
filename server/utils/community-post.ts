export const MAX_COMMUNITY_POSTS_PER_DAY = 10
export const MAX_COMMUNITY_POST_COMMENTS = 100

/** A post and its comments go together, in one multi-location update. */
export function queueCommunityPostRemoval(postId: string, writes: Record<string, unknown>): void {
  writes[`communityPosts/${postId}`] = null
  writes[`communityPostComments/${postId}`] = null
}
