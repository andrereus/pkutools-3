import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostCommentSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { MAX_COMMUNITY_POST_COMMENTS } from '../../utils/community-post'
import {
  assertVisibleTo,
  readStatePath,
  queueThreadParticipants
} from '../../utils/community-thread'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { postId, commentId, comment } = await validateBody(event, CommunityPostCommentSchema)
  const db = getAdminDatabase()
  const postSnapshot = await db.ref(`communityPosts/${postId}`).once('value')

  if (!postSnapshot.exists()) {
    throw createError({ statusCode: 404, message: 'Post not found' })
  }
  await assertVisibleTo(postSnapshot.val(), postSnapshot.val().authorId, userId)

  if (commentId) {
    const commentRef = db.ref(`communityPostComments/${postId}/${commentId}`)
    const existing = (await commentRef.once('value')).val() as Record<string, unknown> | null

    if (!existing) {
      throw createError({ statusCode: 404, message: 'Comment not found' })
    }
    if (existing.authorId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Cannot edit another account’s comment',
        data: { code: 'forbidden' }
      })
    }

    await commentRef.update({ text: comment, updatedAt: Date.now() })
    return { success: true }
  }

  const post = postSnapshot.val() as Record<string, unknown>
  const storedCount = Number(post.commentCount)
  const commentCount = Number.isSafeInteger(storedCount) && storedCount >= 0 ? storedCount : 0
  if (commentCount >= MAX_COMMUNITY_POST_COMMENTS) {
    throw createError({
      statusCode: 409,
      message: 'Post comment limit reached',
      data: { code: 'community-post-comment-limit' }
    })
  }

  const now = Date.now()
  const threadRef = db.ref(`communityPostComments/${postId}`)
  const newCommentKey = threadRef.push().key as string
  const newComment = {
    type: 'comment',
    authorId: userId,
    text: comment,
    createdAt: now,
    updatedAt: now
  }
  const thread = ((await threadRef.once('value')).val() ?? {}) as Record<string, unknown>

  // The comment, the count, the activity time and the conversation entries of
  // everyone in it change in one atomic update. Writing a comment counts as
  // reading the thread. On someone else's post the commenter joins the
  // conversation, so later comments there notify them.
  const writes: Record<string, unknown> = {
    [`communityPostComments/${postId}/${newCommentKey}`]: newComment,
    [`communityPosts/${postId}/commentCount`]: ServerValue.increment(1),
    [`communityPosts/${postId}/${post.authorId === userId ? 'lastAuthorCommentAt' : 'lastCommunityCommentAt'}`]:
      now,
    [`${readStatePath(userId, 'post', postId)}/lastReadAt`]: now
  }
  await queueThreadParticipants(
    writes,
    'post',
    postId,
    { ...thread, [newCommentKey]: newComment },
    post.authorId,
    { joiningId: userId }
  )
  await db.ref().update(writes)

  return { success: true }
})
