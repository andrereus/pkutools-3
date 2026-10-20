import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { queueCommunityPostRemoval } from '../../utils/community-post'
import { communityFoodCommentActivity } from '../../utils/community-food-comment'

type Thread = Record<string, Record<string, unknown> | null>

/** The comments in a thread that this account wrote. */
const commentIdsBy = (thread: Thread, userId: string): string[] =>
  Object.entries(thread).flatMap(([id, comment]) =>
    comment && comment.type !== 'content-update' && comment.authorId === userId ? [id] : []
  )

/** A post's comment activity once some of its comments are gone. */
const postActivityWithout = (thread: Thread, authorId: unknown, removedIds: string[]) => {
  const remaining = Object.fromEntries(
    Object.entries(thread).filter(([id]) => !removedIds.includes(id))
  )
  const activity = communityFoodCommentActivity(remaining, authorId, '')
  return {
    lastCommunityCommentAt: activity.lastCommunityCommentAt,
    lastAuthorCommentAt: activity.lastContributorCommentAt
  }
}

export default defineAuthedHandler(async ({ userId }) => {
  const db = getAdminDatabase()
  const auth = getAdminAuth()

  // Posts, comments on posts and the community name are personal, so they
  // leave with the account; posts together with their threads. So does
  // anything of theirs an admin removed and could otherwise still restore, and
  // admin rights.
  const [posts, removed, joined] = await Promise.all([
    db.ref('communityPosts').orderByChild('authorId').equalTo(userId).once('value'),
    db.ref('removedContent').once('value'),
    db.ref(`${userId}/communityThreads/posts`).once('value')
  ])
  const ownPostIds = Object.keys(posts.val() ?? {})
  const writes: Record<string, unknown> = {
    [`communityProfiles/${userId}`]: null,
    [`admins/${userId}`]: null
  }
  for (const postId of ownPostIds) queueCommunityPostRemoval(postId, writes)

  // Every comment on someone else's post records its thread with it, so these
  // are all the posts the account commented on.
  const joinedPostIds = Object.keys(joined.val() ?? {}).filter(
    (postId) => !ownPostIds.includes(postId)
  )
  const joinedThreads = await Promise.all(
    joinedPostIds.map(async (postId) => {
      const [thread, post] = await Promise.all([
        db.ref(`communityPostComments/${postId}`).once('value'),
        db.ref(`communityPosts/${postId}`).once('value')
      ])
      return {
        postId,
        thread: (thread.val() ?? {}) as Thread,
        post: post.val() as Record<string, unknown> | null
      }
    })
  )
  for (const { postId, thread, post } of joinedThreads) {
    const ids = commentIdsBy(thread, userId)
    if (ids.length === 0) continue
    for (const id of ids) writes[`communityPostComments/${postId}/${id}`] = null
    if (post) {
      writes[`communityPosts/${postId}/commentCount`] = ServerValue.increment(-ids.length)
      for (const [field, value] of Object.entries(
        postActivityWithout(thread, post.authorId, ids)
      )) {
        writes[`communityPosts/${postId}/${field}`] = value
      }
    }
  }

  // Removed posts keep a copy of their thread. The account's comments leave
  // those copies too, so restoring a post cannot bring them back.
  const removedEntries = (removed.val() ?? {}) as Record<string, Record<string, unknown> | null>
  for (const [removedId, entry] of Object.entries(removedEntries)) {
    if (!entry) continue
    if (entry.authorId === userId) {
      writes[`removedContent/${removedId}`] = null
      continue
    }
    if (entry.type !== 'post' || !entry.thread || typeof entry.thread !== 'object') continue
    const thread = entry.thread as Thread
    const ids = commentIdsBy(thread, userId)
    if (ids.length === 0) continue
    const record = (entry.record ?? {}) as Record<string, unknown>
    const storedCount = Number(record.commentCount)
    for (const id of ids) writes[`removedContent/${removedId}/thread/${id}`] = null
    writes[`removedContent/${removedId}/record/commentCount`] = Math.max(
      0,
      (Number.isSafeInteger(storedCount) ? storedCount : 0) - ids.length
    )
    for (const [field, value] of Object.entries(
      postActivityWithout(thread, record.authorId, ids)
    )) {
      writes[`removedContent/${removedId}/record/${field}`] = value
    }
  }
  await db.ref().update(writes)

  // Shared foods, comments on foods, votes and likes remain as contributions
  // after account deletion. Only the private subtree is removed; once the Auth
  // user is deleted, retained comments can no longer be edited by that account.
  const userDataRef = db.ref(`/${userId}`)
  await userDataRef.remove()

  // Delete the user account from Firebase Auth
  await auth.deleteUser(userId)

  return { success: true }
})
