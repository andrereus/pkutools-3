import { getAdminDatabase } from '../../utils/firebase-admin'
import { LabValueUpdateSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input
    const validation = LabValueUpdateSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const { entryKey, data } = validation.data

    const db = getAdminDatabase()
    const labValueRef = db.ref(`/${userId}/labValues/${entryKey}`)
    const labValueSnapshot = await labValueRef.once('value')
    const labValue = labValueSnapshot.val()

    if (!labValue) {
      throw createError({
        statusCode: 404,
        message: 'Lab value entry not found'
      })
    }

    // Update the entry
    await labValueRef.update(data)

    return {
      success: true,
      key: entryKey
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

