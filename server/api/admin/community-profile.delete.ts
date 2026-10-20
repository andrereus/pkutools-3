import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminCommunityProfileDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { currentNameKey, queueNameKeyRelease } from '../../utils/community-name'

// Removes a community name and frees it. Its posts and comments then show as
// anonymous.
export default defineAdminHandler(async ({ event }) => {
  const { userId } = await validateBody(event, AdminCommunityProfileDeleteSchema)
  const writes: Record<string, unknown> = { [`communityProfiles/${userId}`]: null }
  await queueNameKeyRelease(writes, userId, await currentNameKey(userId))
  await getAdminDatabase().ref().update(writes)
  return { success: true }
})
