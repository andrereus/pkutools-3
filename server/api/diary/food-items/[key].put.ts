import { getAdminDatabase } from '../../../utils/firebase-admin'
import { UpdateFoodItemSchema } from '../../../types/schemas'
import { defineAuthedHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'
import { applyDiaryEditProvenance } from '../../../utils/food-provenance'
import { resolveDiaryItemIndex } from '../../../utils/diary-item'
import { storedNumberOrZero } from '../../../utils/numeric'

export default defineAuthedHandler(async ({ event, userId }) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Entry key is required'
    })
  }

  const { itemId, logIndex, entry } = await validateBody(event, UpdateFoodItemSchema)

  const db = getAdminDatabase()
  const diaryRef = db.ref(`/${userId}/pheDiary/${key}`)
  const diarySnapshot = await diaryRef.once('value')
  const diaryEntry = diarySnapshot.val()

  if (!diaryEntry) {
    throw createError({
      statusCode: 404,
      message: 'Diary entry not found'
    })
  }

  const log = diaryEntry.log || []
  const resolvedLogIndex = resolveDiaryItemIndex(log, { itemId, logIndex })

  // Update the log item; immutable identity, provenance and the stored
  // createdAt win over anything the client sent. A legacy item receives its
  // stable id the first time it is edited.
  const now = Date.now()
  const updatedLog = [...log]
  const storedItem = log[resolvedLogIndex]
  const entryWithProvenance = applyDiaryEditProvenance(storedItem, entry)
  updatedLog[resolvedLogIndex] = {
    ...entryWithProvenance,
    itemId: storedItem.itemId || db.ref(`/${userId}/pheDiary/${key}/logItemIds`).push().key!,
    ...(storedItem.createdAt != null && { createdAt: storedItem.createdAt }),
    updatedAt: now
  }

  const totalPhe = updatedLog.reduce((sum: number, item) => sum + storedNumberOrZero(item.phe), 0)
  const totalKcal = updatedLog.reduce((sum: number, item) => sum + storedNumberOrZero(item.kcal), 0)

  // Update the entry
  await diaryRef.update({
    log: updatedLog,
    phe: totalPhe,
    kcal: totalKcal,
    updatedAt: now
  })

  return {
    success: true,
    key: key
  }
})
