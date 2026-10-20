import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityFoodCommentDeleteSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { removeThreadComment } from '../../utils/community-thread'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { communityFoodKey, commentId } = await validateBody(
    event,
    CommunityFoodCommentDeleteSchema
  )
  const existing = (
    await getAdminDatabase()
      .ref(`communityFoodComments/${communityFoodKey}/${commentId}`)
      .once('value')
  ).val() as Record<string, unknown> | null

  if (!existing) return { success: true }
  if (existing.type === 'content-update' || existing.authorId !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Cannot delete another account’s comment',
      data: { code: 'forbidden' }
    })
  }

  await removeThreadComment('food', communityFoodKey, commentId)
  return { success: true }
})
