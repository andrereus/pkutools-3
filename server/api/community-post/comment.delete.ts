import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostCommentDeleteSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { removeThreadComment } from '../../utils/community-post'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { postId, commentId } = await validateBody(event, CommunityPostCommentDeleteSchema)
  const db = getAdminDatabase()
  const existing = (
    await db.ref(`communityPostComments/${postId}/${commentId}`).once('value')
  ).val() as Record<string, unknown> | null

  if (!existing) return { success: true }
  if (existing.authorId !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Cannot delete another account’s comment',
      data: { code: 'forbidden' }
    })
  }

  await removeThreadComment('post', postId, commentId)
  return { success: true }
})
