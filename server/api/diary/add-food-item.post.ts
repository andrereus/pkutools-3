import { getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'
import { format } from 'date-fns'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input - expect a single log entry with optional date
    const validation = DiaryEntrySchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const isPremium = await checkPremiumStatus(userId)

    // Determine date
    const date = body.date || format(new Date(), 'yyyy-MM-dd')

    const diaryRef = db.ref(`/${userId}/pheDiary`)
    const diarySnapshot = await diaryRef.once('value')
    const diaryData = diarySnapshot.val() || {}

    // Find existing entry for this date
    // This API is for adding food items to days, so we merge with existing day if date matches
    interface DiaryEntry {
      date: string
      log?: Array<unknown>
    }
    let existingEntryKey: string | null = null
    for (const [key, entry] of Object.entries(diaryData)) {
      if ((entry as DiaryEntry).date === date) {
        existingEntryKey = key
        break
      }
    }

    // Check diary entry limit for free users (only when creating new date entry)
    if (!isPremium && !existingEntryKey) {
      const entryCount = diaryData ? Object.keys(diaryData).length : 0

      if (entryCount >= 14) {
        throw createError({
          statusCode: 403,
          message: 'Diary limit reached. Upgrade to premium for unlimited entries.'
        })
      }
    }

    if (existingEntryKey) {
      // Update existing entry - add new log item
      interface DiaryEntry {
        date: string
        log: Array<{ phe: number; kcal: number }>
        phe: number
        kcal: number
      }
      const existingEntry = diaryData[existingEntryKey] as DiaryEntry
      const updatedLog = [...(existingEntry.log || []), validation.data]

      // Calculate totals
      const totalPhe = updatedLog.reduce((sum: number, item) => sum + (item.phe || 0), 0)
      const totalKcal = updatedLog.reduce((sum: number, item) => sum + (item.kcal || 0), 0)

      await db.ref(`/${userId}/pheDiary/${existingEntryKey}`).update({
        log: updatedLog,
        phe: totalPhe,
        kcal: totalKcal
      })

      return {
        success: true,
        key: existingEntryKey,
        updated: true
      }
    } else {
      // Create new entry
      const logEntry = validation.data
      const totalPhe = logEntry.phe || 0
      const totalKcal = logEntry.kcal || 0

      const newEntryRef = db.ref(`/${userId}/pheDiary`).push()
      await newEntryRef.set({
        date,
        phe: totalPhe,
        kcal: totalKcal,
        log: [logEntry]
      })

      return {
        success: true,
        key: newEntryRef.key,
        updated: false
      }
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
