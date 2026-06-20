import { getAdminDatabase } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { GettingStartedSchema } from '../../types/schemas'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { completed } = await validateBody(event, GettingStartedSchema)

  const db = getAdminDatabase()
  const settingsRef = db.ref(`/${userId}/settings`)

  await settingsRef.update({
    gettingStartedCompleted: completed
  })

  return { success: true }
})
