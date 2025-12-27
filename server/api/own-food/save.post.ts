import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input with Zod schema
    const validation = OwnFoodSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    // Write to Firebase via Admin SDK
    const db = getAdminDatabase()
    const ownFoodRef = db.ref(`/${userId}/ownFood`)
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
