import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueCommunityPostRemoval } from '../../utils/community-post'

// Deletes a post and its comments for good.
export default defineAdminHandler(async ({ event }) => {
  const { postId } = await validateBody(event, CommunityPostDeleteSchema)
  const db = getAdminDatabase()
  const post = (await db.ref(`communityPosts/${postId}`).once('value')).val() as Record<
    string,
    unknown
  > | null
  // A thread left without its post is removed as well.
  const writes: Record<string, unknown> = {}
  await queueCommunityPostRemoval(postId, post?.authorId, writes)
  await db.ref().update(writes)
  return { success: true }
})
