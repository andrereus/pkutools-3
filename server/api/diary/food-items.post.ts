import { getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'
import { format } from 'date-fns'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { storedNumberOrZero } from '../../utils/numeric'
import { z } from 'zod'

const MAX_ITEMS_PER_REQUEST = 50

// Either a single log entry or `{ items }`, several entries for the same day
// (a meal split into ingredients). A list is appended in one write, so the day
// never ends up holding only part of it. The optional date is not part of
// DiaryEntrySchema: it only selects the day.
const DiaryFoodItemRequestSchema = z.preprocess(
  // A single entry is the same request with one item
  (body) =>
    body !== null && typeof body === 'object' && !Array.isArray((body as { items?: unknown }).items)
      ? { date: (body as { date?: unknown }).date, items: [body] }
      : body,
  z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
      .optional(),
    items: z
      .array(DiaryEntrySchema)
      .min(1, 'At least one food item is required')
      .max(MAX_ITEMS_PER_REQUEST, 'Too many food items')
  })
)

export default defineAuthedHandler(async ({ event, userId }) => {
  const { date: requestDate, items } = await validateBody(event, DiaryFoodItemRequestSchema)

  // Timestamps are server-owned; client values are honored only so
  // undo-restore can keep the original creation time of a deleted item.
  const now = Date.now()
  const logEntriesData = items.map((item) => ({
    ...item,
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now
  }))

  const db = getAdminDatabase()
  const isPremium = await checkPremiumStatus(userId)

  // Push ids are unique and stable; timestamps are not. A restored item may
  // keep its original id as long as that id is not already present in the day
  // or earlier in the same request.
  const withItemIds = (existingLog: Array<{ itemId?: string }> = []) => {
    const takenIds = new Set(existingLog.map((item) => item.itemId))
    return logEntriesData.map((logEntryData) => {
      const requestedId = logEntryData.itemId
      const itemId =
        requestedId && !takenIds.has(requestedId)
          ? requestedId
          : db.ref(`/${userId}/pheDiary/logItemIds`).push().key!
      takenIds.add(itemId)
      return { ...logEntryData, itemId }
    })
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
  for (const { communityFoodKey } of logEntriesData) {
    if (!communityFoodKey) continue
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
    // Update existing entry - add new log items
    interface DiaryEntry {
      date: string
      log: Array<{ itemId?: string; phe: unknown; kcal: unknown }>
      phe: number
      kcal: number
    }
    // Use the value we already fetched from the query
    const existingEntry = existingEntryVal as DiaryEntry
    const logEntries = withItemIds(existingEntry.log || [])
    const updatedLog = [...(existingEntry.log || []), ...logEntries]

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
    const logEntries = withItemIds()
    const totalPhe = logEntries.reduce((sum, item) => sum + storedNumberOrZero(item.phe), 0)
    const totalKcal = logEntries.reduce((sum, item) => sum + storedNumberOrZero(item.kcal), 0)

    const newEntryRef = db.ref(`/${userId}/pheDiary`).push()
    await newEntryRef.set({
      date,
      phe: totalPhe,
      kcal: totalKcal,
      log: logEntries,
      // The day comes into existence with its first item, so it inherits that
      // item's createdAt — on undo-restore this recovers the original day
      // creation time (the first restored item is the oldest one).
      createdAt: logEntries[0]!.createdAt,
      updatedAt: now
    })

    return {
      success: true,
      key: newEntryRef.key,
      updated: false
    }
  }
})
