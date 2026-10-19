import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminCommunityFoodDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueCommunityFoodCommentRemoval } from '../../utils/community-food-comment'
import {
  isDatabaseKey,
  queueExpiredRemovals,
  queueRemovedEntry,
  stringOrNull
} from '../../utils/moderation'

// Removes a food and its comments from the community, restorably.
export default defineAdminHandler(async ({ event, userId }) => {
  const { communityFoodKey } = await validateBody(event, AdminCommunityFoodDeleteSchema)
  const db = getAdminDatabase()
  const [foodSnapshot, threadSnapshot] = await Promise.all([
    db.ref(`communityFoods/${communityFoodKey}`).once('value'),
    db.ref(`communityFoodComments/${communityFoodKey}`).once('value')
  ])
  const food = foodSnapshot.val() as Record<string, unknown> | null

  const writes: Record<string, unknown> = {}
  await queueExpiredRemovals(writes)

  if (food) {
    writes[`communityFoods/${communityFoodKey}`] = null
    queueCommunityFoodCommentRemoval(communityFoodKey, writes)

    // The contributor keeps their own food, now unshared. Only a pointer that
    // both records agree on is followed, and only to an own food that exists.
    let unsharedOwnFood = false
    if (isDatabaseKey(food.contributorId) && isDatabaseKey(food.ownFoodKey)) {
      const ownFoodPath = `${food.contributorId}/ownFood/${food.ownFoodKey}`
      const ownFood = (await db.ref(ownFoodPath).once('value')).val() as Record<
        string,
        unknown
      > | null
      if (ownFood?.communityKey === communityFoodKey) {
        writes[`${ownFoodPath}/shared`] = false
        writes[`${ownFoodPath}/communityKey`] = null
        unsharedOwnFood = true
      }
    }

    queueRemovedEntry(
      {
        type: 'food',
        key: communityFoodKey,
        authorId: stringOrNull(food.contributorId),
        language: stringOrNull(food.language),
        record: food,
        thread: threadSnapshot.val() ?? null,
        unsharedOwnFood,
        removedAt: Date.now(),
        removedBy: userId
      },
      writes
    )
  }

  if (Object.keys(writes).length > 0) await db.ref().update(writes)
  return { success: true }
})
