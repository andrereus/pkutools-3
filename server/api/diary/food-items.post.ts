import { getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'
import { format } from 'date-fns'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { z } from 'zod'

// Extended schema to accept optional communityFoodKey (not stored in diary)
const DiaryFoodItemRequestSchema = DiaryEntrySchema.extend({
  communityFoodKey: z.string().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input - expect a single log entry with optional date and communityFoodKey
    const validation = DiaryFoodItemRequestSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    // Extract communityFoodKey (used for tracking, not stored)
    const { communityFoodKey, ...diaryEntryData } = validation.data

    const db = getAdminDatabase()
    const isPremium = await checkPremiumStatus(userId)

    // Determine date
    const date = body.date || format(new Date(), 'yyyy-MM-dd')

    // Find existing entry for this date efficiently
    const querySnapshot = await db.ref(`/${userId}/pheDiary`)
      .orderByChild('date')
      .equalTo(date)
      .limitToFirst(1)
      .once('value')

    let existingEntryKey: string | null = null
    let existingEntryVal: any = null

    if (querySnapshot.exists()) {
      const data = querySnapshot.val()
      existingEntryKey = Object.keys(data)[0]
      existingEntryVal = data[existingEntryKey]
    }

    // Check diary entry limit for free users (only when creating new date entry)
    if (!isPremium && !existingEntryKey) {
      // Free users: Must fetch minimal data to count entries before creating new one
      const diaryRef = db.ref(`/${userId}/pheDiary`)
      // limit is 14, so fetch 15 to be sure we exceeded it
      const diarySnapshot = await diaryRef.limitToFirst(15).once('value')
      const entryCount = diarySnapshot.numChildren()

      if (entryCount >= 14) {
        throw createError({
          statusCode: 403,
          message: 'Diary limit reached. Upgrade to premium for unlimited entries.'
        })
      }
    }

    // If communityFoodKey provided, increment usage count (fire and forget)
    if (communityFoodKey) {
      const communityFoodRef = db.ref(`communityFoods/${communityFoodKey}`)
      communityFoodRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
          const currentUsage = snapshot.val().usageCount || 0
          communityFoodRef.update({ usageCount: currentUsage + 1 })
        }
      }).catch(() => {
        // Silently ignore errors - usage tracking is not critical
      })
    }

    if (existingEntryKey) {
      // Update existing entry - add new log item
      interface DiaryEntry {
        date: string
        log: Array<{ phe: number; kcal: number }>
        phe: number
        kcal: number
      }
      // Use the value we already fetched from the query
      const existingEntry = existingEntryVal as DiaryEntry
      const updatedLog = [...(existingEntry.log || []), diaryEntryData]

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
      // Note: There's a potential race condition here if two requests come in simultaneously
      // Both might find no existing entry and both create new entries
      // For production, consider using Firebase transactions for atomicity
      const logEntry = diaryEntryData
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

