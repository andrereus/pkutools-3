import { getAdminDatabase } from '../utils/firebase-admin'
import { CommunityReadSchema } from '../types/schemas'
import { defineAuthedHandler } from '../utils/handler'
import { validateBody } from '../utils/validation'

// The owner of a food or post, or someone who commented on it, opened its
// comments. Kept in their private data, so a comment read on one device no
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
  const joined =
    ownerId === userId ||
    (await db.ref(`${userId}/communityThreads/${target}s/${key}`).once('value')).exists()
  if (!joined) {
    throw createError({
      statusCode: 403,
      message: 'Only the owner and commenters read comments as notifications',
      data: { code: 'forbidden' }
    })
  }

  await db.ref(`${userId}/communityReads/${target}s/${key}`).set(Date.now())
  return { success: true }
})
