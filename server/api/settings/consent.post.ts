import { getAdminDatabase } from '../../utils/firebase-admin'
import { formatISO } from 'date-fns'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { ConsentSchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = ConsentSchema.safeParse(body)

    if (!validation.success) {
      formatValidationError(validation.error)
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

      // Initialize history if needed (preserve original consent date if it exists)
      if (healthHistory.length === 0 && currentSettings.healthDataConsentDate) {
        healthHistory.push({
          action: currentSettings.healthDataConsent === true ? 'given' : 'revoked',
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

      // Initialize history if needed (preserve original consent date if it exists)
      if (emailHistory.length === 0 && currentSettings.emailConsentDate) {
        emailHistory.push({
          action: currentSettings.emailConsent === true ? 'given' : 'revoked',
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

