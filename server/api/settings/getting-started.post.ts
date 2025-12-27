import { getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'

const GettingStartedSchema = z.object({
  completed: z.boolean()
})

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = GettingStartedSchema.safeParse(body)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const settingsRef = db.ref(`/${userId}/settings`)

    await settingsRef.update({
      gettingStartedCompleted: validation.data.completed
    })

    return { success: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

