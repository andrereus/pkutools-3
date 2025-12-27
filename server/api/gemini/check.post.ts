import { getAdminDatabase } from '../../utils/firebase-admin'
import { format } from 'date-fns'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { checkPremiumStatus } from '../../utils/license'

// Constants for limits
const BASE_DAILY_ESTIMATE_LIMIT = 20
const FREE_USER_DAILY_ESTIMATE_LIMIT = 2

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const model = body.model || 'gemini-2.5-flash'
    const usePro = model === 'gemini-2.5-pro'

    // Read user settings from Firebase
    const db = getAdminDatabase()
    const settingsRef = db.ref(`/${userId}/settings`)
    const settingsSnapshot = await settingsRef.once('value')
    const settings = settingsSnapshot.val() || {}

    const isPremium = await checkPremiumStatus(userId)

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
    } else if (usePro) {
      dailyLimitCredits = BASE_DAILY_ESTIMATE_LIMIT
      costPerEstimate = 10
    } else {
      dailyLimitCredits = BASE_DAILY_ESTIMATE_LIMIT
      costPerEstimate = 1
    }

    // Check if user can make another estimate
    const projectedCredits = currentCount + costPerEstimate
    const allowed = projectedCredits <= dailyLimitCredits
    const remainingCredits = Math.max(0, dailyLimitCredits - currentCount)
    const remainingEstimates = Math.floor(remainingCredits / costPerEstimate)

    if (allowed) {
      // Increment estimation count
      const newCount = currentCount + costPerEstimate
      await settingsRef.update({
        estimationCount: newCount,
        estimationDate: today
      })
    }

    return {
      allowed,
      remaining: remainingEstimates,
      resetAt: today // Date when limit resets
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
