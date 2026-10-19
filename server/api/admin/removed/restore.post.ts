import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from '../../../utils/firebase-admin'
import { RemovedContentSchema } from '../../../types/schemas'
import { defineAdminHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'
import { communityFoodCommentActivity } from '../../../utils/community-food-comment'
import {
  isDatabaseKey,
  isRemovalExpired,
  queueExpiredRemovals,
  type RemovedEntry
} from '../../../utils/moderation'

const conflict = (message: string) =>
  createError({ statusCode: 409, message, data: { code: 'restore-conflict' } })

// Puts removed content back where it was. Refuses when its place has changed
// since, rather than restoring something that no longer fits.
export default defineAdminHandler(async ({ event }) => {
  const { removedId } = await validateBody(event, RemovedContentSchema)
  const db = getAdminDatabase()
  const entry = (await db.ref(`removedContent/${removedId}`).once('value')).val() as
    (RemovedEntry & Record<string, unknown>) | null

  if (!entry || isRemovalExpired(entry) || !isDatabaseKey(entry.key)) {
    throw createError({ statusCode: 404, message: 'Removed content not found' })
  }

  const writes: Record<string, unknown> = {}
  await queueExpiredRemovals(writes)
  writes[`removedContent/${removedId}`] = null
  const exists = async (path: string) => (await db.ref(path).once('value')).exists()

  if (entry.type === 'post') {
    if (await exists(`communityPosts/${entry.key}`)) throw conflict('The post exists again.')
    writes[`communityPosts/${entry.key}`] = entry.record
    if (entry.thread) writes[`communityPostComments/${entry.key}`] = entry.thread
  } else if (entry.type === 'food') {
    if (await exists(`communityFoods/${entry.key}`)) throw conflict('The food exists again.')
    writes[`communityFoods/${entry.key}`] = entry.record
    if (entry.thread) writes[`communityFoodComments/${entry.key}`] = entry.thread

    // Removal unshared the contributor's own food; restoring shares it again,
    // but only if it still exists and has not been shared anew since.
    if (entry.unsharedOwnFood) {
      const { contributorId, ownFoodKey } = entry.record
      if (!isDatabaseKey(contributorId) || !isDatabaseKey(ownFoodKey)) {
        throw conflict('The food no longer belongs to an own food.')
      }
      const ownFoodPath = `${contributorId}/ownFood/${ownFoodKey}`
      const ownFood = (await db.ref(ownFoodPath).once('value')).val() as Record<
        string,
        unknown
      > | null
      if (!ownFood || (ownFood.communityKey && ownFood.communityKey !== entry.key)) {
        throw conflict('The contributor has deleted or shared this food again since.')
      }
      writes[`${ownFoodPath}/shared`] = true
      writes[`${ownFoodPath}/communityKey`] = entry.key
    }
  } else if (entry.type === 'comment') {
    if (!isDatabaseKey(entry.parentKey) || (entry.target !== 'food' && entry.target !== 'post')) {
      throw conflict('The comment has no thread to return to.')
    }
    const parentPath =
      entry.target === 'food'
        ? `communityFoods/${entry.parentKey}`
        : `communityPosts/${entry.parentKey}`
    const threadPath =
      entry.target === 'food'
        ? `communityFoodComments/${entry.parentKey}`
        : `communityPostComments/${entry.parentKey}`
    const [parentSnapshot, threadSnapshot] = await Promise.all([
      db.ref(parentPath).once('value'),
      db.ref(threadPath).once('value')
    ])
    const parent = parentSnapshot.val() as Record<string, unknown> | null
    if (!parent) throw conflict(`The ${entry.target} it was written on is gone.`)
    const thread = (threadSnapshot.val() ?? {}) as Record<string, unknown>
    if (thread[entry.key]) throw conflict('The comment exists again.')

    // The count and the activity times include the comment again.
    const ownerId = entry.target === 'food' ? parent.contributorId : parent.authorId
    const activity = communityFoodCommentActivity(
      { ...thread, [entry.key]: entry.record },
      ownerId,
      ''
    )
    writes[`${threadPath}/${entry.key}`] = entry.record
    writes[`${parentPath}/commentCount`] = ServerValue.increment(1)
    writes[`${parentPath}/lastCommunityCommentAt`] = activity.lastCommunityCommentAt
    writes[
      `${parentPath}/${entry.target === 'food' ? 'lastContributorCommentAt' : 'lastAuthorCommentAt'}`
    ] = activity.lastContributorCommentAt
  } else {
    throw conflict('Unknown kind of content.')
  }

  await db.ref().update(writes)
  return { success: true }
})
