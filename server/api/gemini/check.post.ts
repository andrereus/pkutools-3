import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { format } from 'date-fns'

// Constants for limits
const BASE_DAILY_ESTIMATE_LIMIT = 20
const FREE_USER_DAILY_ESTIMATE_LIMIT = 2

export default defineEventHandler(async (event) => {
  try {
    // Get auth token from header
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)

    // Verify token and get user ID
    const decodedToken = await verifyIdToken(token)
    const userId = decodedToken.uid

    // Get model preference from request body
    const body = await readBody(event)
    const model = body.model || 'gemini-2.5-flash'
    const usePro = model === 'gemini-2.5-pro'

    // Read user settings from Firebase
    const db = getAdminDatabase()
    const settingsRef = db.ref(`/${userId}/settings`)
    const settingsSnapshot = await settingsRef.once('value')
    const settings = settingsSnapshot.val() || {}

    // Check license status
    const config = useRuntimeConfig()
    const licenseKey = settings.license
    const isPremium = licenseKey === config.pkutoolsLicenseKey

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
    // Handle Firebase auth errors
    const firebaseError = error as { code?: string }
    if (
      firebaseError.code === 'auth/id-token-expired' ||
      firebaseError.code === 'auth/argument-error'
    ) {
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      })
    }

    // Re-throw createError instances
    const httpError = error as { statusCode?: number }
    if (httpError.statusCode) {
      throw error
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
