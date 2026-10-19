import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueCommunityPostRemoval } from '../../utils/community-post'
import { queueExpiredRemovals, queueRemovedEntry, stringOrNull } from '../../utils/moderation'

// Removes a post and its comments from the community, restorably.
export default defineAdminHandler(async ({ event, userId }) => {
  const { postId } = await validateBody(event, CommunityPostDeleteSchema)
  const db = getAdminDatabase()
  const [postSnapshot, threadSnapshot] = await Promise.all([
    db.ref(`communityPosts/${postId}`).once('value'),
    db.ref(`communityPostComments/${postId}`).once('value')
  ])
  const post = postSnapshot.val() as Record<string, unknown> | null

  const writes: Record<string, unknown> = {}
  await queueExpiredRemovals(writes)
  if (post) {
    queueRemovedEntry(
      {
        type: 'post',
        key: postId,
        authorId: stringOrNull(post.authorId),
        language: stringOrNull(post.language),
        record: post,
        thread: threadSnapshot.val() ?? null,
        removedAt: Date.now(),
        removedBy: userId
      },
      writes
    )
    queueCommunityPostRemoval(postId, writes)
  }

  if (Object.keys(writes).length > 0) await db.ref().update(writes)
  return { success: true }
})
