import { getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'

const CreateDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative')
})

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

    // Always create a new day entry, even if a day with this date already exists
    // This is for the diet-report page where you can have multiple entries per date
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
