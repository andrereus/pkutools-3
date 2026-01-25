import { getAdminDatabase } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { ResetSchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = ResetSchema.safeParse(body.type)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const resetType = validation.data

    switch (resetType) {
      case 'diary': {
        const dataRef = db.ref(`/${userId}/pheDiary`)
        await dataRef.remove()
        break
      }
      case 'labValues': {
        const dataRef = db.ref(`/${userId}/labValues`)
        await dataRef.remove()
        break
      }
      case 'ownFood': {
        // For ownFood, preserve shared foods to maintain community data integrity
        const ownFoodRef = db.ref(`/${userId}/ownFood`)
        const snapshot = await ownFoodRef.once('value')
        const foods = snapshot.val()

        if (foods) {
          const deletePromises: Promise<void>[] = []
          let sharedCount = 0

          for (const [key, food] of Object.entries(foods)) {
            const foodData = food as { shared?: boolean }
            if (foodData.shared === true) {
              // Skip shared foods - preserve them
              sharedCount++
            } else {
              // Delete non-shared foods
              deletePromises.push(db.ref(`/${userId}/ownFood/${key}`).remove())
            }
          }

          await Promise.all(deletePromises)

          return {
            success: true,
            type: resetType,
            sharedFoodsPreserved: sharedCount
          }
        }
        break
      }
      default:
        throw createError({
          statusCode: 400,
          message: 'Invalid reset type'
        })
    }

    return { success: true, type: resetType }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
