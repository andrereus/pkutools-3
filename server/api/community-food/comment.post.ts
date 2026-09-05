import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityFoodCommentSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { MAX_COMMUNITY_FOOD_COMMENTS } from '../../utils/community-food-comment'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { communityFoodKey, commentId, comment } = await validateBody(
    event,
    CommunityFoodCommentSchema
  )
  const db = getAdminDatabase()
  const foodSnapshot = await db.ref(`communityFoods/${communityFoodKey}`).once('value')

  if (!foodSnapshot.exists()) {
    throw createError({ statusCode: 404, message: 'Community food not found' })
  }

  if (commentId) {
    const commentRef = db.ref(`communityFoodComments/${communityFoodKey}/${commentId}`)
    const commentSnapshot = await commentRef.once('value')
    const existing = commentSnapshot.val() as Record<string, unknown> | null

    if (!existing) {
      throw createError({ statusCode: 404, message: 'Comment not found' })
    }
    if (existing.authorId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Cannot edit another account’s comment',
        data: { code: 'forbidden' }
      })
    }

    await commentRef.update({ text: comment, updatedAt: Date.now() })
    return { success: true }
  }

  // The count is maintained in the same atomic update as each comment. This
  // keeps the normal request path cheap and avoids loading comment text here.
  const storedFood = foodSnapshot.val() as Record<string, unknown>
  const storedCommentCount = Number(storedFood.commentCount)
  const commentCount =
    Number.isSafeInteger(storedCommentCount) && storedCommentCount >= 0 ? storedCommentCount : 0
  // Reserve the final place for the contributor's reply. Like the overall
  // limit, this is checked against the snapshot without serializing requests.
  const commentLimit =
    storedFood.contributorId === userId
      ? MAX_COMMUNITY_FOOD_COMMENTS
      : MAX_COMMUNITY_FOOD_COMMENTS - 1
  if (commentCount >= commentLimit) {
    throw createError({
      statusCode: 409,
      message: 'Community food comment limit reached',
      data: { code: 'community-food-comment-limit' }
    })
  }

  const now = Date.now()
  const newCommentRef = db.ref(`communityFoodComments/${communityFoodKey}`).push()

  // The comment and its list-level count change together in one atomic update.
  // ServerValue.increment is the same concurrency primitive used by votes.
  await db.ref().update({
    [`communityFoodComments/${communityFoodKey}/${newCommentRef.key}`]: {
      authorId: userId,
      text: comment,
      createdAt: now,
      updatedAt: now
    },
    [`communityFoods/${communityFoodKey}/commentCount`]: ServerValue.increment(1)
  })

  return { success: true }
})
