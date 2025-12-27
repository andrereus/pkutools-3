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
    const diaryEntryRef = db.ref(`/${userId}/pheDiary/${entryKey}`)
    const diaryEntrySnapshot = await diaryEntryRef.once('value')

    if (!diaryEntrySnapshot.exists()) {
      throw createError({
        statusCode: 404,
        message: 'Diary entry not found'
      })
    }

    await diaryEntryRef.remove()

    return { success: true, key: entryKey }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

