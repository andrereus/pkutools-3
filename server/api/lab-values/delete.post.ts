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
    const labValueRef = db.ref(`/${userId}/labValues/${entryKey}`)
    const labValueSnapshot = await labValueRef.once('value')

    if (!labValueSnapshot.exists()) {
      throw createError({
        statusCode: 404,
        message: 'Lab value entry not found'
      })
    }

    await labValueRef.remove()

    return { success: true, key: entryKey }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

