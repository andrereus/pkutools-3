import { getAdminDatabase } from '../../../utils/firebase-admin'
import { defineAuthedHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'
import { DeleteFoodItemSchema } from '../../../types/schemas'
import { resolveDiaryItemIndex } from '../../../utils/diary-item'
import { storedNumberOrZero } from '../../../utils/numeric'

export default defineAuthedHandler(async ({ event, userId }) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Day entry key is required'
    })
  }

  const { itemId, logIndex } = await validateBody(event, DeleteFoodItemSchema)

  const db = getAdminDatabase()
  const diaryEntryRef = db.ref(`/${userId}/pheDiary/${key}`)
  const diaryEntrySnapshot = await diaryEntryRef.once('value')
  const existingDiaryEntry = diaryEntrySnapshot.val() as {
    log?: Array<{ itemId?: string; phe?: unknown; kcal?: unknown }>
  } | null

  if (!existingDiaryEntry) {
    throw createError({
      statusCode: 404,
      message: 'Diary entry not found'
    })
  }

  const currentLog = existingDiaryEntry.log || []
  const resolvedLogIndex = resolveDiaryItemIndex(currentLog, { itemId, logIndex })

  // Remove the log item
  currentLog.splice(resolvedLogIndex, 1)

  // Recalculate totals
  const totalPhe = currentLog.reduce((sum: number, item) => sum + storedNumberOrZero(item.phe), 0)
  const totalKcal = currentLog.reduce((sum: number, item) => sum + storedNumberOrZero(item.kcal), 0)

  await diaryEntryRef.update({
    log: currentLog,
    phe: totalPhe,
    kcal: totalKcal,
    updatedAt: Date.now()
  })

  return { success: true, key: key, deletedLogIndex: resolvedLogIndex }
})
