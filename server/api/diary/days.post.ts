import { getAdminDatabase } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { CreateDaySchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = CreateDaySchema.safeParse(body)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const isPremium = await checkPremiumStatus(userId)

    const { date, phe, kcal } = validation.data

    // Check diary entry limit for free users
    const diaryRef = db.ref(`/${userId}/pheDiary`)
    const diarySnapshot = await diaryRef.once('value')
    const diaryData = diarySnapshot.val() || {}

    if (!isPremium) {
      const entryCount = diaryData ? Object.keys(diaryData).length : 0

      if (entryCount >= 14) {
        throw createError({
          statusCode: 403,
          message: 'Diary limit reached. Upgrade to premium for unlimited entries.'
        })
      }
    }

    // Check if an entry with this date already exists
    // Prevent duplicate date entries to avoid confusion
    interface DiaryEntry {
      date: string
    }
    for (const entry of Object.values(diaryData)) {
      if ((entry as DiaryEntry).date === date) {
        throw createError({
          statusCode: 409,
          message: 'An entry with this date already exists. Please edit the existing entry instead.'
        })
      }
    }

    // Create a new day entry (only if no duplicate date exists)
    const newEntryRef = db.ref(`/${userId}/pheDiary`).push()
    await newEntryRef.set({
      date,
      phe,
      kcal,
      log: [] // Empty log array - this is a day entry, not a food item entry
    })

    return {
      success: true,
      key: newEntryRef.key
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
