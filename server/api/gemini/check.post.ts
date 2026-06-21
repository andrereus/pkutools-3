import { getAdminDatabase } from '../../utils/firebase-admin'
import { ServerValue } from 'firebase-admin/database'
import { format } from 'date-fns'
import { defineAuthedHandler } from '../../utils/handler'
import { licenseFlags } from '../../utils/license'

// Constants for limits
const BASE_DAILY_ESTIMATE_LIMIT = 20
const PREMIUM_AI_DAILY_ESTIMATE_LIMIT = 100
const FREE_USER_DAILY_ESTIMATE_LIMIT = 3

export default defineAuthedHandler(async ({ event, userId }) => {
  const body = await readBody(event)
  const model = body.model || 'gemini-2.5-flash'
  const usePro = model === 'gemini-2.5-pro'

  // Read user settings from Firebase
  const db = getAdminDatabase()
  const settingsRef = db.ref(`/${userId}/settings`)
  const settingsSnapshot = await settingsRef.once('value')
  const settings = settingsSnapshot.val() || {}

  // Derive entitlement from the settings we just read — no extra DB reads
  const { premium: isPremium, premiumAI: isPremiumAI } = licenseFlags(settings.license)

  // Pro model is only available for Premium+AI users
  if (usePro && !isPremiumAI) {
    throw createError({
      statusCode: 403,
      message: 'Pro model is only available with Premium+AI plan'
    })
  }

  // Get current estimation count
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.estimationDate
  const currentCount = estimateDate === today ? settings.estimationCount || 0 : 0

  // Determine limits based on license and model
  let dailyLimitCredits: number
  let costPerEstimate: number

  if (!isPremium) {
    dailyLimitCredits = FREE_USER_DAILY_ESTIMATE_LIMIT
    costPerEstimate = 1
  } else if (isPremiumAI && usePro) {
    // Premium+AI with Pro model: 10 estimates per day (100 credits / 10 cost)
    dailyLimitCredits = PREMIUM_AI_DAILY_ESTIMATE_LIMIT
    costPerEstimate = 10
  } else if (isPremiumAI) {
    // Premium+AI with Flash model: 100 estimates per day
    dailyLimitCredits = PREMIUM_AI_DAILY_ESTIMATE_LIMIT
    costPerEstimate = 1
  } else {
    // Regular Premium with Flash model: 20 estimates per day
    dailyLimitCredits = BASE_DAILY_ESTIMATE_LIMIT
    costPerEstimate = 1
  }

  // Check if user can make another estimate
  const projectedCredits = currentCount + costPerEstimate
  const allowed = projectedCredits <= dailyLimitCredits
  const remainingCredits = Math.max(0, dailyLimitCredits - currentCount)
  const remainingEstimates = Math.floor(remainingCredits / costPerEstimate)

  if (allowed) {
    if (estimateDate === today) {
      // Same day: atomic server-side increment so concurrent requests don't lose
      // updates (which would let the count fall behind and allow over-use).
      await settingsRef.update({ estimationCount: ServerValue.increment(costPerEstimate) })
    } else {
      // New day: reset the counter to this estimate's cost.
      await settingsRef.update({
        estimationCount: costPerEstimate,
        estimationDate: today
      })
    }
  }

  return {
    allowed,
    remaining: remainingEstimates,
    resetAt: today // Date when limit resets
  }
})
