import { getAdminDatabase } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { SettingsUpdateSchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = SettingsUpdateSchema.safeParse(body)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const settingsRef = db.ref(`/${userId}/settings`)

    // Only update the fields that were provided
    const updateData: Record<string, unknown> = {}
    if (validation.data.maxPhe !== undefined) {
      updateData.maxPhe = validation.data.maxPhe || 0
    }
    if (validation.data.maxKcal !== undefined) {
      updateData.maxKcal = validation.data.maxKcal || 0
    }
    if (validation.data.labUnit !== undefined) {
      updateData.labUnit = validation.data.labUnit
    }
    if (validation.data.license !== undefined) {
      updateData.license = validation.data.license || ''
    }

    await settingsRef.update(updateData)

    return { success: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
