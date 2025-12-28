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

    const db = getAdminDatabase()
    const { date } = validation.data

    // Check if an entry with this date already exists
    // Prevent duplicate date entries to avoid confusion
    const labValuesRef = db.ref(`/${userId}/labValues`)
    const labValuesSnapshot = await labValuesRef.once('value')
    const labValuesData = labValuesSnapshot.val() || {}

    interface LabValueEntry {
      date: string
    }
    for (const entry of Object.values(labValuesData)) {
      if ((entry as LabValueEntry).date === date) {
        throw createError({
          statusCode: 409,
          message: 'An entry with this date already exists. Please edit the existing entry instead.'
        })
      }
    }

    // Write to Firebase via Admin SDK (only if no duplicate date exists)
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
