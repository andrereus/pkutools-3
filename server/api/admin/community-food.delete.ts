import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminCommunityFoodDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueCommunityFoodCommentRemoval } from '../../utils/community-food-comment'

const isDatabaseKey = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !/[.#$[\]/]/.test(value)

// Deletes a food and its comments from the community for good. The
// contributor keeps their own food, unshared.
export default defineAdminHandler(async ({ event }) => {
  const { communityFoodKey } = await validateBody(event, AdminCommunityFoodDeleteSchema)
  const db = getAdminDatabase()
  const food = (await db.ref(`communityFoods/${communityFoodKey}`).once('value')).val() as Record<
    string,
    unknown
  > | null

  if (!food) return { success: true }

  const writes: Record<string, unknown> = { [`communityFoods/${communityFoodKey}`]: null }
  queueCommunityFoodCommentRemoval(communityFoodKey, writes)

  // Only a pointer that both records agree on is followed, and only to an own
  // food that exists.
  if (isDatabaseKey(food.contributorId) && isDatabaseKey(food.ownFoodKey)) {
    const ownFoodPath = `${food.contributorId}/ownFood/${food.ownFoodKey}`
    const ownFood = (await db.ref(ownFoodPath).once('value')).val() as Record<
      string,
      unknown
    > | null
    if (ownFood?.communityKey === communityFoodKey) {
      writes[`${ownFoodPath}/shared`] = false
      writes[`${ownFoodPath}/communityKey`] = null
    }
  }

  await db.ref().update(writes)
  return { success: true }
})
