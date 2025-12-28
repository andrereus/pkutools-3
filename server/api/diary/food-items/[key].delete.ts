import { getAdminDatabase } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { z } from 'zod'

const DeleteFoodItemSchema = z.object({
  logIndex: z.number().int().nonnegative('Valid log index is required')
})

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const key = getRouterParam(event, 'key')
    const body = await readBody(event)

    if (!key) {
      throw createError({
        statusCode: 400,
        message: 'Day entry key is required'
      })
    }

    const validation = DeleteFoodItemSchema.safeParse(body)
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        message: validation.error.errors[0]?.message || 'Invalid request body'
      })
    }

    const { logIndex } = validation.data

    const db = getAdminDatabase()
    const diaryEntryRef = db.ref(`/${userId}/pheDiary/${key}`)
    const diaryEntrySnapshot = await diaryEntryRef.once('value')
    const existingDiaryEntry = diaryEntrySnapshot.val()

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
    const totalPhe = currentLog.reduce((sum: number, item: any) => sum + (item.phe || 0), 0)
    const totalKcal = currentLog.reduce((sum: number, item: any) => sum + (item.kcal || 0), 0)

    await diaryEntryRef.update({
      log: currentLog,
      phe: totalPhe,
      kcal: totalKcal
    })

    return { success: true, key: key, deletedLogIndex: logIndex }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

