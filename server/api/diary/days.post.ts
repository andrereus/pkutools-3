import { getAdminDatabase } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { CreateDaySchema } from '../../types/schemas'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { date, phe, kcal } = await validateBody(event, CreateDaySchema)

  const db = getAdminDatabase()
  const isPremium = await checkPremiumStatus(userId)

  const diaryRef = db.ref(`/${userId}/pheDiary`)

  // Duplicate date check — uses the date index, so it's accurate regardless of
  // how many entries the user has (e.g. someone who downgraded from premium and
  // still has more than the free cap).
  const duplicateSnapshot = await diaryRef.orderByChild('date').equalTo(date).once('value')
  if (duplicateSnapshot.exists()) {
    throw createError({
      statusCode: 409,
      message: 'An entry with this date already exists. Please edit the existing entry instead.',
      data: { code: 'duplicate-date' }
    })
  }

  // Free users are capped at 14 entries (fetch 15 to know we've exceeded it).
  if (!isPremium) {
    const diarySnapshot = await diaryRef.limitToFirst(15).once('value')
    if (diarySnapshot.numChildren() >= 14) {
      throw createError({
        statusCode: 403,
        message: 'Diary limit reached. Upgrade to premium for unlimited entries.',
        data: { code: 'limit-reached' }
      })
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
})
