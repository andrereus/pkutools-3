import { getAdminDatabase } from '../utils/firebase-admin'
import { CommunityReadSchema } from '../types/schemas'
import { defineAuthedHandler } from '../utils/handler'
import { validateBody } from '../utils/validation'
import { readStatePath } from '../utils/community-thread'

// The owner of a food or post, or someone who commented on it, opened its
// comments. Kept in their read state, so a comment read on one device no
// longer shows as a notification on another.
export default defineAuthedHandler(async ({ event, userId }) => {
  const { target, key } = await validateBody(event, CommunityReadSchema)
  const db = getAdminDatabase()
  const record = (
    await db
      .ref(target === 'food' ? `communityFoods/${key}` : `communityPosts/${key}`)
      .once('value')
  ).val() as Record<string, unknown> | null

  if (!record) return { success: true }
  const ownerId = target === 'food' ? record.contributorId : record.authorId
  const entryRef = db.ref(readStatePath(userId, target, key))
  const joined = ownerId === userId || (await entryRef.once('value')).exists()
  if (!joined) {
    throw createError({
      statusCode: 403,
      message: 'Only the owner and commenters read comments as notifications',
      data: { code: 'forbidden' }
    })
  }

  await entryRef.update({ lastReadAt: Date.now() })
  return { success: true }
})
