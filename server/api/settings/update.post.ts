import { getAdminDatabase } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { SettingsUpdateSchema } from '../../types/schemas'

export default defineAuthedHandler(async ({ event, userId }) => {
  const settings = await validateBody(event, SettingsUpdateSchema)

  const db = getAdminDatabase()
  const settingsRef = db.ref(`/${userId}/settings`)

  // Only update the fields that were provided
  // Use nullish coalescing to preserve null values (null is different from undefined)
  const updateData: Record<string, unknown> = {}
  if (settings.maxPhe !== undefined) {
    updateData.maxPhe = settings.maxPhe ?? null
  }
  if (settings.maxKcal !== undefined) {
    updateData.maxKcal = settings.maxKcal ?? null
  }
  if (settings.labUnit !== undefined) {
    updateData.labUnit = settings.labUnit
  }
  if (settings.progressStyle !== undefined) {
    updateData.progressStyle = settings.progressStyle
  }
  if (settings.license !== undefined) {
    updateData.license = settings.license ?? null
  }

  await settingsRef.update(updateData)

  return { success: true }
})
