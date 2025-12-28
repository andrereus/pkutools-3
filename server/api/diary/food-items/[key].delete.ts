import { getAdminDatabase } from '../../../utils/firebase-admin'
import { handleServerError } from '../../../utils/error-handler'
import { getAuthenticatedUser } from '../../../utils/auth'
import type { z } from 'zod'
import { DeleteFoodItemSchema } from '../../../types/schemas'

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
        message: validation.error.issues[0]?.message || 'Invalid request body'
      })
    }

    // TypeScript: validation.data is guaranteed to exist after success check
    const { logIndex } = validation.data as z.infer<typeof DeleteFoodItemSchema>

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
  } catch (error: unknown) {
    handleServerError(error)
  }
})
