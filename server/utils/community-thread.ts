import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from './firebase-admin'
import { communityFoodCommentActivity } from './community-food-comment'
import { isAdmin } from './admin'

// Foods and posts both carry a comment thread. The mapping from either to its
// paths and fields lives here, so a further kind of content fits the same way.

export type ThreadTarget = 'food' | 'post'
type Thread = Record<string, unknown>

// An account ID is used as a path below, so only a valid database key is.
const isAccountId = (value: unknown): value is string =>
  typeof value === 'string' && /^[^.#$[\]/]{1,128}$/.test(value)

export const threadPaths = (target: ThreadTarget, key: string) =>
  target === 'food'
    ? { parent: `communityFoods/${key}`, thread: `communityFoodComments/${key}` }
    : { parent: `communityPosts/${key}`, thread: `communityPostComments/${key}` }

/** The account a food or post belongs to. */
export const threadOwner = (target: ThreadTarget, record: Record<string, unknown> | null) =>
  target === 'food' ? record?.contributorId : record?.authorId

/**
 * Content an admin hid is there only for its owner and for admins. To anyone
 * else it does not exist, so they cannot vote, like or comment on it.
 */
export async function assertVisibleTo(
  record: Record<string, unknown>,
  ownerId: unknown,
  userId: string
): Promise<void> {
  if (!record.hiddenAt || ownerId === userId || (await isAdmin(userId))) return
  throw createError({ statusCode: 404, message: 'Not found' })
}

/**
 * Adds the parent's comment activity, rebuilt from its comments without
 * `excludedIds`, to an existing atomic update.
 */
export function queueThreadActivity(
  writes: Record<string, unknown>,
  target: ThreadTarget,
  key: string,
  thread: Thread,
  ownerId: unknown,
  excludedIds: readonly string[] = []
): void {
  const { parent } = threadPaths(target, key)
  const remaining = Object.fromEntries(
    Object.entries(thread).filter(([id]) => !excludedIds.includes(id))
  )
  const activity = communityFoodCommentActivity(remaining, ownerId, '')
  writes[`${parent}/lastCommunityCommentAt`] = activity.lastCommunityCommentAt
  writes[`${parent}/${target === 'food' ? 'lastContributorCommentAt' : 'lastAuthorCommentAt'}`] =
    activity.lastContributorCommentAt
}

/**
 * Someone whose last comment on another account's food or post is deleted
 * leaves its conversation: it no longer notifies them. Adds that to an
 * existing atomic update. `removedCommentIds` are the comments being deleted.
 */
export function queueThreadLeave(
  writes: Record<string, unknown>,
  target: ThreadTarget,
  key: string,
  thread: Thread,
  authorId: unknown,
  ownerId: unknown,
  removedCommentIds: readonly string[]
): void {
  if (!isAccountId(authorId) || authorId === ownerId) return
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
 * Rewrites the conversation entry of everyone who commented on someone else's
 * food or post: the newest comment there by someone else, 0 while there is
 * none. Compared with their read time, it tells their app where something is
 * new without loading the thread. Adds that to an existing atomic update, built
 * from `thread` without `excludedIds`. Only entries that exist are rewritten,
 * plus the one of `joiningId`, who is commenting now, so an account that is
 * gone never gets private data back.
 */
export async function queueThreadParticipants(
  writes: Record<string, unknown>,
  target: ThreadTarget,
  key: string,
  thread: Thread,
  ownerId: unknown,
  {
    excludedIds = [],
    joiningId = null
  }: { excludedIds?: readonly string[]; joiningId?: string | null } = {}
): Promise<void> {
  const comments = Object.entries(thread).flatMap(([id, raw]) => {
    if (excludedIds.includes(id) || !raw || typeof raw !== 'object') return []
    const comment = raw as Record<string, unknown>
    const { authorId, createdAt } = comment
    if (comment.type !== undefined && comment.type !== 'comment') return []
    if (!isAccountId(authorId)) return []
    if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt <= 0) {
      return []
    }
    return [{ authorId, createdAt, removed: Boolean(comment.hiddenAt) }]
  })
  const newest = (list: typeof comments) => Math.max(0, ...list.map((item) => item.createdAt))
  const entryPath = (userId: string) => `${userId}/communityThreads/${target}s/${key}`

  const participants = [...new Set(comments.map((item) => item.authorId))].filter(
    (userId) => userId !== ownerId
  )
  const db = getAdminDatabase()
  const present = await Promise.all(
    participants.map(
      async (userId) =>
        userId === joiningId || (await db.ref(entryPath(userId)).once('value')).exists()
    )
  )
  participants.forEach((userId, index) => {
    if (!present[index]) return
    // A comment an admin removed notifies no one.
    writes[entryPath(userId)] = {
      lastOtherCommentAt: newest(
        comments.filter((item) => item.authorId !== userId && !item.removed)
      )
    }
  })
}

/**
 * Deletes the whole thread of a food or post that is deleted or no longer
 * shared, and the conversation with it: the owner's read entry and every
 * commenter's joined and read entries. Adds that to an existing atomic update.
 */
export async function queueThreadRemoval(
  writes: Record<string, unknown>,
  target: ThreadTarget,
  key: string,
  ownerId: unknown
): Promise<void> {
  const paths = threadPaths(target, key)
  const thread = ((await getAdminDatabase().ref(paths.thread).once('value')).val() ?? {}) as Thread
  writes[paths.thread] = null
  const participants = new Set<unknown>([ownerId])
  for (const raw of Object.values(thread)) {
    participants.add((raw as Record<string, unknown> | null)?.authorId)
  }
  for (const userId of participants) {
    if (!isAccountId(userId)) continue
    writes[`${userId}/communityReads/${target}s/${key}`] = null
    if (userId !== ownerId) writes[`${userId}/communityThreads/${target}s/${key}`] = null
  }
}

/**
 * Deletes one human comment from a food or post thread, keeping the parent's
 * count and comment activity in step, and lets its author leave the
 * conversation when it was their last comment there. History entries are not
 * comments and are never deleted this way: returns false for them.
 */
export async function removeThreadComment(
  target: ThreadTarget,
  key: string,
  commentId: string
): Promise<boolean> {
  const db = getAdminDatabase()
  const paths = threadPaths(target, key)
  const [threadSnapshot, parentSnapshot] = await Promise.all([
    db.ref(paths.thread).once('value'),
    db.ref(paths.parent).once('value')
  ])
  const thread = (threadSnapshot.val() ?? {}) as Record<string, Record<string, unknown> | null>
  const existing = thread[commentId]

  if (!existing) return true
  if (existing.type === 'content-update') return false

  const writes: Record<string, unknown> = { [`${paths.thread}/${commentId}`]: null }
  const parent = parentSnapshot.val() as Record<string, unknown> | null
  if (parent) {
    const ownerId = threadOwner(target, parent)
    // A hidden comment is already out of the comment count, and in the hidden one.
    const counter = existing.hiddenAt ? 'hiddenCommentCount' : 'commentCount'
    writes[`${paths.parent}/${counter}`] = ServerValue.increment(-1)
    queueThreadActivity(writes, target, key, thread, ownerId, [commentId])
    queueThreadLeave(writes, target, key, thread, existing.authorId, ownerId, [commentId])
    await queueThreadParticipants(writes, target, key, thread, ownerId, {
      excludedIds: [commentId]
    })
  }

  await db.ref().update(writes)
  return true
}
