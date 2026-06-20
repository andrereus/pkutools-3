import { getAdminDatabase } from '../../../utils/firebase-admin'
import { defineAuthedHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'
import { DeleteFoodItemSchema } from '../../../types/schemas'

export default defineAuthedHandler(async ({ event, userId }) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Day entry key is required'
    })
  }

  const { logIndex } = await validateBody(event, DeleteFoodItemSchema)

  const db = getAdminDatabase()
  const diaryEntryRef = db.ref(`/${userId}/pheDiary/${key}`)
  const diaryEntrySnapshot = await diaryEntryRef.once('value')
  const existingDiaryEntry = diaryEntrySnapshot.val() as {
    log?: Array<{ phe?: number; kcal?: number }>
  } | null

  if (!existingDiaryEntry) {
    throw createError({
      statusCode: 404,
      message: 'Diary entry not found'
    })
  }

  const currentLog = existingDiaryEntry.log || []
  if (logIndex >= currentLog.length) {
    throw createError({
      statusCode: 400,
      message: 'Invalid log item index'
    })
  }

  // Remove the log item
  currentLog.splice(logIndex, 1)

  // Recalculate totals
  const totalPhe = currentLog.reduce((sum: number, item) => sum + (item.phe || 0), 0)
  const totalKcal = currentLog.reduce((sum: number, item) => sum + (item.kcal || 0), 0)

  await diaryEntryRef.update({
    log: currentLog,
    phe: totalPhe,
    kcal: totalKcal
  })

  return { success: true, key: key, deletedLogIndex: logIndex }
})
