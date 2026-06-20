import { getAdminDatabase } from '../../utils/firebase-admin'
import { formatISO } from 'date-fns'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { ConsentSchema } from '../../types/schemas'

export default defineAuthedHandler(async ({ event, userId }) => {
  const consent = await validateBody(event, ConsentSchema)

  const db = getAdminDatabase()
  const settingsRef = db.ref(`/${userId}/settings`)
  const settingsSnapshot = await settingsRef.once('value')
  const currentSettings = settingsSnapshot.val() || {}

  const consentDate = formatISO(new Date(), { representation: 'date' })
  const updateData: Record<string, unknown> = {}

  // Handle health data consent
  if (consent.healthDataConsent !== undefined) {
    const healthConsent = consent.healthDataConsent
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
  if (consent.emailConsent !== undefined) {
    const emailConsent = consent.emailConsent
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
})
