import { getAdminDatabase } from '../../utils/firebase-admin'
import { ServerValue } from 'firebase-admin/database'
import { format } from 'date-fns'
import { defineAuthedHandler } from '../../utils/handler'
import { licenseFlags } from '../../utils/license'

// Daily estimate limits per tier
const BASE_DAILY_ESTIMATE_LIMIT = 20
const PREMIUM_AI_DAILY_ESTIMATE_LIMIT = 100
const FREE_USER_DAILY_ESTIMATE_LIMIT = 3

export default defineAuthedHandler(async ({ userId }) => {
  // Read user settings from Firebase
  const db = getAdminDatabase()
  const settingsRef = db.ref(`/${userId}/settings`)
  const settingsSnapshot = await settingsRef.once('value')
  const settings = settingsSnapshot.val() || {}

  // Derive entitlement from the settings we just read — no extra DB reads
  const { premium: isPremium, premiumAI: isPremiumAI } = licenseFlags(settings.license)

  // Daily limit depends on the user's tier
  let dailyLimit: number
  if (!isPremium) {
    dailyLimit = FREE_USER_DAILY_ESTIMATE_LIMIT
  } else if (isPremiumAI) {
    dailyLimit = PREMIUM_AI_DAILY_ESTIMATE_LIMIT
  } else {
    dailyLimit = BASE_DAILY_ESTIMATE_LIMIT
  }

  // Get current estimation count for today
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.estimationDate
  const currentCount = estimateDate === today ? settings.estimationCount || 0 : 0

  // Check if user can make another estimate
  const allowed = currentCount + 1 <= dailyLimit
  const remaining = Math.max(0, dailyLimit - currentCount)

  if (allowed) {
    if (estimateDate === today) {
      // Same day: atomic server-side increment so concurrent requests don't lose
      // updates (which would let the count fall behind and allow over-use).
      await settingsRef.update({ estimationCount: ServerValue.increment(1) })
    } else {
      // New day: reset the counter to this estimate.
      await settingsRef.update({
        estimationCount: 1,
        estimationDate: today
      })
    }
  }

  return {
    allowed,
    remaining,
    resetAt: today // Date when limit resets
  }
})
