import { getAdminDatabase } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)

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

    // If the food was shared, remove the community food entry (voterIds deleted automatically as child)
    if (ownFood.shared && ownFood.communityKey) {
      await db.ref(`communityFoods/${ownFood.communityKey}`).remove()
    }

    await ownFoodRef.remove()

    return { success: true, key: entryKey }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

