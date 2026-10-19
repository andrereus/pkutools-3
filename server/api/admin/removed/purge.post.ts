import { getAdminDatabase } from '../../../utils/firebase-admin'
import { defineAdminHandler } from '../../../utils/handler'
import { queueExpiredRemovals } from '../../../utils/moderation'

// Deletes removed content past its retention. The admin page calls this when
// it opens; every other admin removal and restore does the same on the way.
export default defineAdminHandler(async () => {
  const writes: Record<string, unknown> = {}
  await queueExpiredRemovals(writes)
  if (Object.keys(writes).length > 0) await getAdminDatabase().ref().update(writes)
  return { success: true, purged: Object.keys(writes).length }
})
