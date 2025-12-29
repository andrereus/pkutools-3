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
    const diaryRef = db.ref(`/${userId}/pheDiary`)

    // Check duplicate date and limit based on premium status
    if (isPremium) {
      // Premium: Use efficient query to check for duplicates
      const duplicateSnapshot = await diaryRef.orderByChild('date').equalTo(date).once('value')
      
      if (duplicateSnapshot.exists()) {
        throw createError({
          statusCode: 409,
          message: 'An entry with this date already exists. Please edit the existing entry instead.'
        })
      }
    } else {
      // Free: Fetch minimal data to check limit AND duplicates locally
      // We only need to know if they have >= 14 entries, so fetch 15
      const diarySnapshot = await diaryRef.limitToFirst(15).once('value')
      const diaryData = diarySnapshot.val() || {}
      
      const entryCount = Object.keys(diaryData).length

      if (entryCount >= 14) {
        throw createError({
          statusCode: 403,
          message: 'Diary limit reached. Upgrade to premium for unlimited entries.'
        })
      }

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
    }

    // Create a new day entry
    const newEntryRef = diaryRef.push()
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
