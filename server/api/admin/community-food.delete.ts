import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminCommunityFoodDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueThreadRemoval } from '../../utils/community-thread'
import { linkedOwnFoodPath } from '../../utils/community-food'

// Deletes a food and its comments from the community for good. The
// contributor keeps their own food, unshared and hidden from the community, so
// it is shared again only once its name or values change.
export default defineAdminHandler(async ({ event }) => {
  const { communityFoodKey } = await validateBody(event, AdminCommunityFoodDeleteSchema)
  const db = getAdminDatabase()
  const food = (await db.ref(`communityFoods/${communityFoodKey}`).once('value')).val() as Record<
    string,
    unknown
  > | null

  if (!food) return { success: true }

  const writes: Record<string, unknown> = { [`communityFoods/${communityFoodKey}`]: null }
  await queueThreadRemoval(writes, 'food', communityFoodKey, food.contributorId)

  const ownFoodPath = await linkedOwnFoodPath(food, communityFoodKey)
  if (ownFoodPath) {
    writes[`${ownFoodPath}/shared`] = false
    writes[`${ownFoodPath}/communityKey`] = null
    writes[`${ownFoodPath}/hiddenAt`] =
      typeof food.hiddenAt === 'number' ? food.hiddenAt : Date.now()
  }

  await db.ref().update(writes)
  return { success: true }
})
