import { getAdminDatabase } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { queueCommunityFoodCommentRemoval } from '../../utils/community-food-comment'

export default defineAuthedHandler(async ({ event, userId }) => {
  const body = await readBody(event)
  const entryKey = body.entryKey

  if (!entryKey || typeof entryKey !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Entry key is required'
    })
  }

  const db = getAdminDatabase()
  const ownFoodRef = db.ref(`/${userId}/ownFood/${entryKey}`)
  const ownFoodSnapshot = await ownFoodRef.once('value')

  if (!ownFoodSnapshot.exists()) {
    throw createError({
      statusCode: 404,
      message: 'Own food entry not found'
    })
  }

  const ownFood = ownFoodSnapshot.val()

  // The own food and its public copy are one logical record. Remove them with
  // one multi-location update so a failed database write leaves both intact
  // instead of deleting the community copy first and leaving a broken pointer
  // behind.
  const writes: Record<string, null> = {
    [`${userId}/ownFood/${entryKey}`]: null
  }

  // The pointer is server-owned, but verify both sides before using it as a
  // destructive target. This still cleans up a legacy record whose `shared`
  // flag drifted while ensuring malformed data cannot delete another food.
  if (typeof ownFood.communityKey === 'string' && ownFood.communityKey) {
    const communityFoodSnapshot = await db
      .ref(`communityFoods/${ownFood.communityKey}`)
      .once('value')
    const communityFood = communityFoodSnapshot.val()

    if (communityFood?.contributorId === userId && communityFood?.ownFoodKey === entryKey) {
      writes[`communityFoods/${ownFood.communityKey}`] = null
      queueCommunityFoodCommentRemoval(ownFood.communityKey, writes)
    }
  }

  await db.ref().update(writes)

  return { success: true, key: entryKey }
})
