import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodUpdateSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input
    const validation = OwnFoodUpdateSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const { entryKey, data } = validation.data

    const db = getAdminDatabase()
    const ownFoodRef = db.ref(`/${userId}/ownFood/${entryKey}`)
    const ownFoodSnapshot = await ownFoodRef.once('value')
    const ownFood = ownFoodSnapshot.val()

    if (!ownFood) {
      throw createError({
        statusCode: 404,
        message: 'Own food entry not found'
      })
    }

    // Update the entry
    await ownFoodRef.update(data)

    return {
      success: true,
      key: entryKey
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

