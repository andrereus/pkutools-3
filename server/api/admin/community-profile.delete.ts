import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminCommunityProfileDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'

// Removes a community name and frees it. Its posts and comments then show as
// anonymous.
export default defineAdminHandler(async ({ event }) => {
  const { userId } = await validateBody(event, AdminCommunityProfileDeleteSchema)
  await getAdminDatabase().ref(`communityProfiles/${userId}`).remove()
  return { success: true }
})
