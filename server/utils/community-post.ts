import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from './firebase-admin'
import { communityFoodCommentActivity } from './community-food-comment'
import { queueExpiredRemovals, queueRemovedEntry, stringOrNull } from './moderation'

export const MAX_COMMUNITY_POSTS_PER_DAY = 10
export const MAX_COMMUNITY_POST_COMMENTS = 100

/** A post and its comments go together, in one multi-location update. */
export function queueCommunityPostRemoval(postId: string, writes: Record<string, unknown>): void {
  writes[`communityPosts/${postId}`] = null
  writes[`communityPostComments/${postId}`] = null
}

/**
 * Someone who deletes their last comment on another account's food or post
 * leaves its conversation: it no longer notifies them. Adds that to an
 * existing atomic update. `removedCommentIds` are the comments being deleted.
 */
export function queueThreadLeave(
  writes: Record<string, unknown>,
  target: 'food' | 'post',
  key: string,
  thread: Record<string, unknown>,
  authorId: unknown,
  ownerId: unknown,
  removedCommentIds: readonly string[]
): void {
  if (typeof authorId !== 'string' || !authorId || authorId === ownerId) return
  const remains = Object.entries(thread).some(([id, raw]) => {
    const comment = raw as Record<string, unknown> | null
    return (
      !removedCommentIds.includes(id) &&
      comment?.type !== 'content-update' &&
      comment?.authorId === authorId
    )
  })
  if (remains) return
  writes[`${authorId}/communityThreads/${target}s/${key}`] = null
  writes[`${authorId}/communityReads/${target}s/${key}`] = null
}

/**
 * Removes one human comment from a food or post thread, keeping the parent's
 * count and comment activity in step. History entries are not comments and
 * are never removed this way. Returns false when the comment is history.
 * With `removedBy`, an admin removal, the comment is kept restorable. With
 * `leave`, its author deleting it, the author leaves the conversation when it
 * was their last comment there.
 */
export async function removeThreadComment(
  target: 'food' | 'post',
  parentKey: string,
  commentId: string,
  options: { removedBy?: string; leave?: boolean } = {}
): Promise<boolean> {
  const db = getAdminDatabase()
  const parentPath =
    target === 'food' ? `communityFoods/${parentKey}` : `communityPosts/${parentKey}`
  const threadPath =
    target === 'food' ? `communityFoodComments/${parentKey}` : `communityPostComments/${parentKey}`
  const [threadSnapshot, parentSnapshot] = await Promise.all([
    db.ref(threadPath).once('value'),
    db.ref(parentPath).once('value')
  ])
  const thread = (threadSnapshot.val() ?? {}) as Record<string, Record<string, unknown> | null>
  const existing = thread[commentId]

  if (!existing) return true
  if (existing.type === 'content-update') return false

  const writes: Record<string, unknown> = { [`${threadPath}/${commentId}`]: null }
  const parent = parentSnapshot.val() as Record<string, unknown> | null

  if (options.removedBy) {
    await queueExpiredRemovals(writes)
    const title = target === 'food' ? parent?.name : parent?.text
    queueRemovedEntry(
      {
        type: 'comment',
        key: commentId,
        target,
        parentKey,
        parentTitle:
          typeof title === 'string' ? (title.length > 50 ? `${title.slice(0, 50)}…` : title) : null,
        authorId: stringOrNull(existing.authorId),
        language: stringOrNull(parent?.language),
        record: existing,
        removedAt: Date.now(),
        removedBy: options.removedBy
      },
      writes
    )
  }

  if (parent) {
    const ownerId = target === 'food' ? parent.contributorId : parent.authorId
    const activity = communityFoodCommentActivity(thread, ownerId, commentId)
    writes[`${parentPath}/commentCount`] = ServerValue.increment(-1)
    writes[`${parentPath}/lastCommunityCommentAt`] = activity.lastCommunityCommentAt
    writes[
      `${parentPath}/${target === 'food' ? 'lastContributorCommentAt' : 'lastAuthorCommentAt'}`
    ] = activity.lastContributorCommentAt
    if (options.leave) {
      queueThreadLeave(writes, target, parentKey, thread, existing.authorId, ownerId, [commentId])
    }
  }

  await db.ref().update(writes)
  return true
}
