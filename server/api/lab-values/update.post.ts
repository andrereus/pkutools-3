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

    // Check for duplicate date if date is being changed
    if (data.date && data.date !== labValue.date) {
      const duplicatesSnapshot = await db.ref(`/${userId}/labValues`)
        .orderByChild('date')
        .equalTo(data.date)
        .once('value')

      // Check if another entry with this date already exists (excluding current entry)
      if (duplicatesSnapshot.exists()) {
        const duplicates = duplicatesSnapshot.val()
        for (const key of Object.keys(duplicates)) {
          if (key !== entryKey) {
            throw createError({
              statusCode: 409,
              message: 'An entry with this date already exists. Please edit the existing entry instead.'
            })
          }
        }
      }
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

