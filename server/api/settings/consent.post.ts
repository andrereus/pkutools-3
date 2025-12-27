import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'
import { formatISO } from 'date-fns'
import { handleServerError } from '../../utils/error-handler'

const ConsentSchema = z.object({
  healthDataConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)
    const decodedToken = await verifyIdToken(token)
    const userId = decodedToken.uid

    const body = await readBody(event)
    const validation = ConsentSchema.safeParse(body)

    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map((issue) => {
          const path = issue.path.join('.')
          return `${path ? `${path}: ` : ''}${issue.message}`
        })
        .join(', ')

      throw createError({
        statusCode: 400,
        message: `Validation failed: ${errorMessages}`,
        data: validation.error.issues
      })
    }

    const db = getAdminDatabase()
    const settingsRef = db.ref(`/${userId}/settings`)
    const settingsSnapshot = await settingsRef.once('value')
    const currentSettings = settingsSnapshot.val() || {}

    const consentDate = formatISO(new Date(), { representation: 'date' })
    const updateData: Record<string, unknown> = {}

    // Handle health data consent
    if (validation.data.healthDataConsent !== undefined) {
      const healthConsent = validation.data.healthDataConsent
      const healthHistory = currentSettings.healthDataConsentHistory || []

      // Initialize history if needed
      if (healthHistory.length === 0 && currentSettings.healthDataConsent === true && currentSettings.healthDataConsentDate) {
        healthHistory.push({
          action: 'given',
          date: currentSettings.healthDataConsentDate
        })
      }

      // Add new history entry
      healthHistory.push({
        action: healthConsent ? 'given' : 'revoked',
        date: consentDate
      })

      // Keep last 10 entries
      const newHealthHistory = healthHistory.slice(-10)

      updateData.healthDataConsent = healthConsent
      updateData.healthDataConsentDate = consentDate
      updateData.healthDataConsentHistory = newHealthHistory
    }

    // Handle email consent
    if (validation.data.emailConsent !== undefined) {
      const emailConsent = validation.data.emailConsent
      const emailHistory = currentSettings.emailConsentHistory || []

      // Initialize history if needed
      if (emailHistory.length === 0 && currentSettings.emailConsent === true && currentSettings.emailConsentDate) {
        emailHistory.push({
          action: 'given',
          date: currentSettings.emailConsentDate
        })
      }

      // Add new history entry
      emailHistory.push({
        action: emailConsent ? 'given' : 'revoked',
        date: consentDate
      })

      // Keep last 10 entries
      const newEmailHistory = emailHistory.slice(-10)

      updateData.emailConsent = emailConsent
      updateData.emailConsentDate = emailConsent ? consentDate : null
      updateData.emailConsentHistory = newEmailHistory
    }

    await settingsRef.update(updateData)

    return { success: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

