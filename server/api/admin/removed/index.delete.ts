import { getAdminDatabase } from '../../../utils/firebase-admin'
import { RemovedContentSchema } from '../../../types/schemas'
import { defineAdminHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'
import { queueExpiredRemovals } from '../../../utils/moderation'

// Deletes removed content for good, before its retention runs out.
export default defineAdminHandler(async ({ event }) => {
  const { removedId } = await validateBody(event, RemovedContentSchema)
  const writes: Record<string, unknown> = { [`removedContent/${removedId}`]: null }
  await queueExpiredRemovals(writes)
  await getAdminDatabase().ref().update(writes)
  return { success: true }
})
