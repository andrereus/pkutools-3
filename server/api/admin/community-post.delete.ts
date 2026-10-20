import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueCommunityPostRemoval } from '../../utils/community-post'

// Deletes a post and its comments for good.
export default defineAdminHandler(async ({ event }) => {
  const { postId } = await validateBody(event, CommunityPostDeleteSchema)
  const writes: Record<string, unknown> = {}
  queueCommunityPostRemoval(postId, writes)
  await getAdminDatabase().ref().update(writes)
  return { success: true }
})
