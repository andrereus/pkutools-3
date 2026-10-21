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
  const isOwner = ownerId === userId
  const entryRef = db.ref(readStatePath(userId, target, key))
  const joined = isOwner || (await entryRef.once('value')).exists()
  if (!joined) {
    throw createError({
      statusCode: 403,
      message: 'Only the owner and commenters read comments as notifications',
      data: { code: 'forbidden' }
    })
  }

  // A commenter's entry that disappeared meanwhile, because they left the
  // conversation or the thread was deleted, stays gone.
  const now = Date.now()
  await entryRef.transaction((current: Record<string, unknown> | null) =>
    current === null && !isOwner ? null : { ...current, lastReadAt: now }
  )
  return { success: true }
})
