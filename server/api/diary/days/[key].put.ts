import { getAdminDatabase } from '../../../utils/firebase-admin'
import { UpdateDaySchema } from '../../../types/schemas'
import type { z } from 'zod'
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

    // Build update object with all fields that need to be updated
    const updateData: Record<string, unknown> = {
      phe: phe,
      kcal: kcal
    }

    // Include date if provided, but check for duplicates first
    if (date !== undefined) {
      // Only check for duplicates if the date is actually changing
      if (date !== existingDiaryEntry.date) {
        const duplicatesSnapshot = await db
          .ref(`/${userId}/pheDiary`)
          .orderByChild('date')
          .equalTo(date)
          .once('value')

        // Check if another entry with this date already exists (excluding current entry)
        if (duplicatesSnapshot.exists()) {
          const duplicates = duplicatesSnapshot.val()
          for (const entryKey of Object.keys(duplicates)) {
            if (entryKey !== key) {
              throw createError({
                statusCode: 409,
                message:
                  'An entry with this date already exists. Please edit the existing entry instead.'
              })
            }
          }
        }
      }
      updateData.date = date
    }

    // If log array is provided, use it (to sync deletions)
    // If log is not provided, preserve the existing log (whether empty or not)
    if (log !== undefined) {
      updateData.log = log
    }
    // If log is not provided, don't update log (preserve existing log structure)

    await diaryEntryRef.update(updateData)

    return { success: true, key: key, updated: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
