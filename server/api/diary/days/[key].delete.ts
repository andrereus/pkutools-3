import { getAdminDatabase } from '../../../utils/firebase-admin'
import { defineAuthedHandler } from '../../../utils/handler'

export default defineAuthedHandler(async ({ event, userId }) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Day entry key is required'
    })
  }

  const db = getAdminDatabase()
  const diaryEntryRef = db.ref(`/${userId}/pheDiary/${key}`)
  const diaryEntrySnapshot = await diaryEntryRef.once('value')

  if (!diaryEntrySnapshot.exists()) {
    throw createError({
      statusCode: 404,
      message: 'Diary entry not found'
    })
  }

  await diaryEntryRef.remove()

  return { success: true, key: key }
})
