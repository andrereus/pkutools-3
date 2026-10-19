import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostDeleteSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueCommunityPostRemoval } from '../../utils/community-post'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { postId } = await validateBody(event, CommunityPostDeleteSchema)
  const db = getAdminDatabase()
  const snapshot = await db.ref(`communityPosts/${postId}`).once('value')
  const existing = snapshot.val() as Record<string, unknown> | null

  if (!existing) return { success: true }
  if (existing.authorId !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Cannot delete another account’s post',
      data: { code: 'forbidden' }
    })
  }

  const writes: Record<string, unknown> = {}
  queueCommunityPostRemoval(postId, writes)
  await db.ref().update(writes)
  return { success: true }
})
