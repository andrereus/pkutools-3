import { getAdminDatabase } from '../../utils/firebase-admin'
import { LabValueSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input with Zod schema
    const validation = LabValueSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    // Write to Firebase via Admin SDK
    const db = getAdminDatabase()
    const labValuesRef = db.ref(`/${userId}/labValues`)
    const newRef = labValuesRef.push()
    await newRef.set(validation.data)

    return {
      success: true,
      key: newRef.key
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
