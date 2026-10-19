import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostLikeSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { postId, liked } = await validateBody(event, CommunityPostLikeSchema)
  const db = getAdminDatabase()
  const postRef = db.ref(`communityPosts/${postId}`)
  const post = (await postRef.once('value')).val() as Record<string, unknown> | null

  if (!post) {
    throw createError({ statusCode: 404, message: 'Post not found' })
  }
  if (post.authorId === userId) {
    throw createError({
      statusCode: 403,
      message: 'Cannot like your own post',
      data: { code: 'forbidden' }
    })
  }

  const likerIds = (post.likerIds ?? {}) as Record<string, unknown>
  if ((likerIds[userId] === true) === liked) return { success: true, liked }

  // The liker entry and the count change together in one atomic update.
  await postRef.update({
    [`likerIds/${userId}`]: liked ? true : null,
    likes: ServerValue.increment(liked ? 1 : -1)
  })

  return { success: true, liked }
})
