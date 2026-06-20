import { getAdminDatabase } from '../../../utils/firebase-admin'
import { UpdateFoodItemSchema } from '../../../types/schemas'
import { defineAuthedHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'

export default defineAuthedHandler(async ({ event, userId }) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Entry key is required'
    })
  }

  const { logIndex, entry } = await validateBody(event, UpdateFoodItemSchema)

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

  // Validate log index
  const log = diaryEntry.log || []
  if (logIndex >= log.length) {
    throw createError({
      statusCode: 400,
      message: 'Log index out of range'
    })
  }

  // Update the log item
  const updatedLog = [...log]
  updatedLog[logIndex] = entry

  // Calculate totals
  const totalPhe = updatedLog.reduce((sum: number, item) => sum + (item.phe || 0), 0)
  const totalKcal = updatedLog.reduce((sum: number, item) => sum + (item.kcal || 0), 0)

  // Update the entry
  await diaryRef.update({
    log: updatedLog,
    phe: totalPhe,
    kcal: totalKcal
  })

  return {
    success: true,
    key: key
  }
})
