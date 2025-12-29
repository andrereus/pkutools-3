import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input with Zod schema
    const validation = OwnFoodSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const isPremium = await checkPremiumStatus(userId)
    const ownFoodRef = db.ref(`/${userId}/ownFood`)

    // Check limit based on premium status
    if (!isPremium) {
      // Free: Fetch minimal data to check limit
      // Limit is 50, so fetch 51 to be sure we exceeded it
      const ownFoodSnapshot = await ownFoodRef.limitToFirst(51).once('value')
      const entryCount = ownFoodSnapshot.numChildren()

      if (entryCount >= 50) {
        throw createError({
          statusCode: 403,
          message: 'Own food limit reached. Upgrade to premium for unlimited entries.'
        })
      }
    }

    // Write to Firebase via Admin SDK (only if limit not reached)
    const newRef = ownFoodRef.push()
    await newRef.set(validation.data)

    return {
      success: true,
      key: newRef.key
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
