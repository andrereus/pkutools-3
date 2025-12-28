import { getAdminDatabase } from '../../../utils/firebase-admin'
import { UpdateDaySchema } from '../../../types/schemas'
import { z } from 'zod'
import { handleServerError } from '../../../utils/error-handler'
import { getAuthenticatedUser } from '../../../utils/auth'
import { formatValidationError } from '../../../utils/validation'

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

    const validation = UpdateDaySchema.safeParse(body)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    // TypeScript: validation.data is guaranteed to exist after success check
    const { date, phe, kcal, log } = validation.data as z.infer<typeof UpdateDaySchema>

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

    // Build update object with all fields that need to be updated
    const updateData: Record<string, unknown> = {
      phe: phe,
      kcal: kcal
    }

    // Include date if provided
    if (date !== undefined) {
      updateData.date = date
    }

    // If log array is provided, use it (to sync deletions)
    // Otherwise, if there are no log items, create a single "Manual Entry" log item
    if (log !== undefined) {
      updateData.log = log
    } else if (currentLog.length === 0) {
      const manualEntry = {
        name: 'Manual Entry',
        emoji: null,
        icon: null,
        pheReference: null,
        kcalReference: null,
        weight: 100,
        phe: phe,
        kcal: kcal
      }
      updateData.log = [manualEntry]
    }
    // If log items exist and log is not provided, don't update log (only totals)

    await diaryEntryRef.update(updateData)

    return { success: true, key: key, updated: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
