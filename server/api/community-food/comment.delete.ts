import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityFoodCommentDeleteSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { communityFoodKey, commentId } = await validateBody(
    event,
    CommunityFoodCommentDeleteSchema
  )
  const db = getAdminDatabase()
  const commentPath = `communityFoodComments/${communityFoodKey}/${commentId}`
  const [commentSnapshot, foodSnapshot] = await Promise.all([
    db.ref(commentPath).once('value'),
    db.ref(`communityFoods/${communityFoodKey}`).once('value')
  ])
  const existing = commentSnapshot.val() as Record<string, unknown> | null

  if (!existing) return { success: true }
  if (existing.authorId !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Cannot delete another account’s comment',
      data: { code: 'forbidden' }
    })
  }

  const writes: Record<string, unknown> = { [commentPath]: null }
  if (foodSnapshot.exists()) {
    writes[`communityFoods/${communityFoodKey}/commentCount`] = ServerValue.increment(-1)
  }

  await db.ref().update(writes)
  return { success: true }
})
