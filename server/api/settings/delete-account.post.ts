import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { queueCommunityPostRemoval } from '../../utils/community-post'
import {
  queueThreadActivity,
  queueThreadParticipants,
  threadPaths
} from '../../utils/community-thread'

type Thread = Record<string, Record<string, unknown> | null>

export default defineAuthedHandler(async ({ userId }) => {
  const db = getAdminDatabase()
  const auth = getAdminAuth()

  // Posts, comments on posts and the community name are personal, so they
  // leave with the account; posts together with their threads, hidden ones
  // included. So do admin rights.
  const [posts, joined] = await Promise.all([
    db.ref('communityPosts').orderByChild('authorId').equalTo(userId).once('value'),
    db.ref(`${userId}/communityThreads/posts`).once('value')
  ])
  const ownPostIds = Object.keys(posts.val() ?? {})
  const writes: Record<string, unknown> = {
    [`communityProfiles/${userId}`]: null,
    [`admins/${userId}`]: null
  }
  await Promise.all(ownPostIds.map((postId) => queueCommunityPostRemoval(postId, userId, writes)))

  // Every comment on someone else's post records its thread with it, so these
  // are all the posts the account commented on.
  const joinedPostIds = Object.keys(joined.val() ?? {}).filter(
    (postId) => !ownPostIds.includes(postId)
  )
  const joinedThreads = await Promise.all(
    joinedPostIds.map(async (postId) => {
      const paths = threadPaths('post', postId)
      const [thread, post] = await Promise.all([
        db.ref(paths.thread).once('value'),
        db.ref(paths.parent).once('value')
      ])
      return {
        postId,
        thread: (thread.val() ?? {}) as Thread,
        post: post.val() as Record<string, unknown> | null
      }
    })
  )
  await Promise.all(
    joinedThreads.map(async ({ postId, thread, post }) => {
      const own = Object.entries(thread).filter(([, comment]) => comment?.authorId === userId)
      if (own.length === 0) return
      const paths = threadPaths('post', postId)
      for (const [id] of own) writes[`${paths.thread}/${id}`] = null
      if (!post) return
      // Hidden comments are already out of the comment count, and in the hidden one.
      const hidden = own.filter(([, comment]) => comment?.hiddenAt).length
      const counted = own.length - hidden
      if (counted > 0) writes[`${paths.parent}/commentCount`] = ServerValue.increment(-counted)
      if (hidden > 0) writes[`${paths.parent}/hiddenCommentCount`] = ServerValue.increment(-hidden)
      const ownIds = own.map(([id]) => id)
      queueThreadActivity(writes, 'post', postId, thread, post.authorId, ownIds)
      await queueThreadParticipants(writes, 'post', postId, thread, post.authorId, {
        excludedIds: ownIds
      })
    })
  )
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
