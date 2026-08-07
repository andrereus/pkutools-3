import { getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'
import { format } from 'date-fns'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { storedNumberOrZero } from '../../utils/numeric'
import { z } from 'zod'

// Extended schema to accept optional date (not part of DiaryEntrySchema)
const DiaryFoodItemRequestSchema = DiaryEntrySchema.extend({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional()
})

export default defineAuthedHandler(async ({ event, userId }) => {
  // Validate input - expect a single log entry with optional date
  const validated = await validateBody(event, DiaryFoodItemRequestSchema)

  // Extract date (not stored in log entry, used to find/create diary day)
  const { date: requestDate, ...diaryEntryData } = validated
  const communityFoodKey = diaryEntryData.communityFoodKey || null

  // Timestamps are server-owned; client values are honored only so
  // undo-restore can keep the original creation time of a deleted item.
  const now = Date.now()
  const logEntryData = {
    ...diaryEntryData,
    createdAt: diaryEntryData.createdAt ?? now,
    updatedAt: diaryEntryData.updatedAt ?? now
  }

  const db = getAdminDatabase()
  const isPremium = await checkPremiumStatus(userId)

  // Push ids are unique and stable; timestamps are not. A restored item may
  // keep its original id as long as that id is not already present in the day.
  const withItemId = (existingLog: Array<{ itemId?: string }> = []) => {
    const requestedId = logEntryData.itemId
    const idAlreadyExists =
      requestedId !== undefined && existingLog.some((item) => item.itemId === requestedId)
    const itemId =
      requestedId && !idAlreadyExists
        ? requestedId
        : db.ref(`/${userId}/pheDiary/logItemIds`).push().key!
    return { ...logEntryData, itemId }
  }

  const date = requestDate || format(new Date(), 'yyyy-MM-dd')

  // Find existing entry for this date efficiently
  const querySnapshot = await db
    .ref(`/${userId}/pheDiary`)
    .orderByChild('date')
    .equalTo(date)
    .limitToFirst(1)
    .once('value')

  let existingEntryKey: string | null = null
  let existingEntryVal: unknown = null

  if (querySnapshot.exists()) {
    const data = querySnapshot.val()
    // exists() guarantees at least one child key
    existingEntryKey = Object.keys(data)[0]!
    existingEntryVal = data[existingEntryKey]
  }

  // Check diary entry limit for free users (only when creating new date entry)
  if (!isPremium && !existingEntryKey) {
    const diaryRef = db.ref(`/${userId}/pheDiary`)
    // Reject creation when a free user already has 14 entries
    const diarySnapshot = await diaryRef.limitToFirst(15).once('value')
    const entryCount = diarySnapshot.numChildren()

    if (entryCount >= 14) {
      throw createError({
        statusCode: 403,
        message: 'Diary limit reached. Upgrade to premium for unlimited entries.',
        data: { code: 'limit-reached' }
      })
    }
  }

  // If communityFoodKey provided, increment usage count (fire and forget)
  if (communityFoodKey) {
    const communityFoodRef = db.ref(`communityFoods/${communityFoodKey}`)
    communityFoodRef
      .once('value')
      .then((snapshot) => {
        if (snapshot.exists()) {
          const currentUsage = snapshot.val().usageCount || 0
          // Returned into the chain so a failed write reaches the catch below
          // rather than escaping as an unhandled rejection
          return communityFoodRef.update({ usageCount: currentUsage + 1 })
        }
      })
      .catch(() => {
        // Usage tracking is not critical, so a failed read or write is dropped
        // rather than failing the diary write it is attached to
      })
  }

  if (existingEntryKey) {
    // TODO: Make full-day log updates concurrency-safe.
    // Update existing entry - add new log item
    interface DiaryEntry {
      date: string
      log: Array<{ itemId?: string; phe: unknown; kcal: unknown }>
      phe: number
      kcal: number
    }
    // Use the value we already fetched from the query
    const existingEntry = existingEntryVal as DiaryEntry
    const logEntry = withItemId(existingEntry.log || [])
    const updatedLog = [...(existingEntry.log || []), logEntry]

    const totalPhe = updatedLog.reduce((sum: number, item) => sum + storedNumberOrZero(item.phe), 0)
    const totalKcal = updatedLog.reduce(
      (sum: number, item) => sum + storedNumberOrZero(item.kcal),
      0
    )

    await db.ref(`/${userId}/pheDiary/${existingEntryKey}`).update({
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal,
      updatedAt: now
    })

    return {
      success: true,
      key: existingEntryKey,
      updated: true
    }
  } else {
    // Create new entry
    // TODO: Make date creation atomic.
    const logEntry = withItemId()
    const totalPhe = storedNumberOrZero(logEntry.phe)
    const totalKcal = storedNumberOrZero(logEntry.kcal)

    const newEntryRef = db.ref(`/${userId}/pheDiary`).push()
    await newEntryRef.set({
      date,
      phe: totalPhe,
      kcal: totalKcal,
      log: [logEntry],
      // The day comes into existence with its first item, so it inherits that
      // item's createdAt — on undo-restore this recovers the original day
      // creation time (the first restored item is the oldest one).
      createdAt: logEntry.createdAt,
      updatedAt: now
    })

    return {
      success: true,
      key: newEntryRef.key,
      updated: false
    }
  }
})
