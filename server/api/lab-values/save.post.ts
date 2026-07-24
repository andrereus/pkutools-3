import { getAdminDatabase } from '../../utils/firebase-admin'
import { LabValueSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'

export default defineAuthedHandler(async ({ event, userId }) => {
  const validated = await validateBody(event, LabValueSchema)

  const db = getAdminDatabase()
  const isPremium = await checkPremiumStatus(userId)
  const { date } = validated
  const labValuesRef = db.ref(`/${userId}/labValues`)

  // Duplicate date check — uses the date index, so it's accurate regardless of
  // how many entries the user has (e.g. someone who downgraded from premium).
  const duplicatesSnapshot = await labValuesRef.orderByChild('date').equalTo(date).once('value')
  if (duplicatesSnapshot.exists()) {
    throw createError({
      statusCode: 409,
      message: 'An entry with this date already exists. Please edit the existing entry instead.',
      data: { code: 'duplicate-date' }
    })
  }

  // Free users are capped at 30 entries (fetch 31 to know we've exceeded it).
  if (!isPremium) {
    const labValuesSnapshot = await labValuesRef.limitToFirst(31).once('value')
    if (labValuesSnapshot.numChildren() >= 30) {
      throw createError({
        statusCode: 403,
        message: 'Lab values limit reached. Upgrade to premium for unlimited entries.',
        data: { code: 'limit-reached' }
      })
    }
  }

  // Write to Firebase via Admin SDK (only if no duplicate date exists and limit
  // not reached). Timestamps are server-owned; client values are honored only
  // so undo-restore can keep the original ones.
  const now = Date.now()
  const newRef = labValuesRef.push()
  await newRef.set({
    ...validated,
    createdAt: validated.createdAt ?? now,
    updatedAt: validated.updatedAt ?? now
  })

  return {
    success: true,
    key: newRef.key
  }
})
