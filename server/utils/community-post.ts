import { queueThreadRemoval } from './community-thread'

export const MAX_COMMUNITY_POSTS_PER_DAY = 10
export const MAX_COMMUNITY_POST_COMMENTS = 100

/** A post and its thread go together, in one multi-location update. */
export async function queueCommunityPostRemoval(
  postId: string,
  authorId: unknown,
  writes: Record<string, unknown>
): Promise<void> {
  writes[`communityPosts/${postId}`] = null
  await queueThreadRemoval(writes, 'post', postId, authorId)
}
