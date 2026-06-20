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

  // Check duplicate date and limit based on premium status
  if (isPremium) {
    // Premium: Use efficient query to check for duplicates
    const duplicatesSnapshot = await labValuesRef.orderByChild('date').equalTo(date).once('value')

    if (duplicatesSnapshot.exists()) {
      throw createError({
        statusCode: 409,
        message: 'An entry with this date already exists. Please edit the existing entry instead.'
      })
    }
  } else {
    // Free: Fetch minimal data to check limit AND duplicates locally
    // Limit is 30, so fetch 31 to be sure we exceeded it
    const labValuesSnapshot = await labValuesRef.limitToFirst(31).once('value')
    const labValuesData = labValuesSnapshot.val() || {}

    const entryCount = Object.keys(labValuesData).length

    if (entryCount >= 30) {
      throw createError({
        statusCode: 403,
        message: 'Lab values limit reached. Upgrade to premium for unlimited entries.'
      })
    }

    // Check for duplicate date
    interface LabValueEntry {
      date: string
    }
    for (const entry of Object.values(labValuesData)) {
      if ((entry as LabValueEntry).date === date) {
        throw createError({
          statusCode: 409,
          message: 'An entry with this date already exists. Please edit the existing entry instead.'
        })
      }
    }
  }

  // Write to Firebase via Admin SDK (only if no duplicate date exists and limit not reached)
  const newRef = labValuesRef.push()
  await newRef.set(validated)

  return {
    success: true,
    key: newRef.key
  }
})
