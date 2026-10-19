import { getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'
import { queueCommunityPostRemoval } from '../../utils/community-post'

export default defineAuthedHandler(async ({ userId }) => {
  const db = getAdminDatabase()
  const auth = getAdminAuth()

  // Posts and the community name are personal, so they leave with the
  // account, posts together with their threads. So does anything of theirs an
  // admin removed and could otherwise still restore, and admin rights.
  const [posts, removed] = await Promise.all([
    db.ref('communityPosts').orderByChild('authorId').equalTo(userId).once('value'),
    db.ref('removedContent').orderByChild('authorId').equalTo(userId).once('value')
  ])
  const communityRemovals: Record<string, unknown> = {
    [`communityProfiles/${userId}`]: null,
    [`admins/${userId}`]: null
  }
  for (const postId of Object.keys(posts.val() ?? {})) {
    queueCommunityPostRemoval(postId, communityRemovals)
  }
  for (const removedId of Object.keys(removed.val() ?? {})) {
    communityRemovals[`removedContent/${removedId}`] = null
  }
  await db.ref().update(communityRemovals)

  // Shared foods, votes, likes and comments remain as contributions after
  // account deletion. Only the private subtree is removed; once the Auth user
  // is deleted, retained comments can no longer be edited by that account.
  const userDataRef = db.ref(`/${userId}`)
  await userDataRef.remove()

  // Delete the user account from Firebase Auth
  await auth.deleteUser(userId)

  return { success: true }
})
