import { getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'
import { z } from 'zod'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'

const UpdateTotalsSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(), // Optional date to allow date changes
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative'),
  log: z.array(DiaryEntrySchema).optional() // Optional log array to sync deletions - validate structure
})

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = UpdateTotalsSchema.safeParse(body)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const { entryKey, date, phe, kcal, log } = validation.data

    const db = getAdminDatabase()
    const diaryEntryRef = db.ref(`/${userId}/pheDiary/${entryKey}`)
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

    return { success: true, key: entryKey, updated: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

