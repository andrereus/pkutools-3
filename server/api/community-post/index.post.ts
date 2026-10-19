import { getAdminDatabase } from '../../utils/firebase-admin'
import { CommunityPostSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { MAX_COMMUNITY_POSTS_PER_DAY } from '../../utils/community-post'

const DAY_MS = 24 * 60 * 60 * 1000

export default defineAuthedHandler(async ({ event, userId }) => {
  const { postId, post, locale } = await validateBody(event, CommunityPostSchema)
  const db = getAdminDatabase()
  const now = Date.now()

  if (postId) {
    const postRef = db.ref(`communityPosts/${postId}`)
    const existing = (await postRef.once('value')).val() as Record<string, unknown> | null
    if (!existing) {
      throw createError({ statusCode: 404, message: 'Post not found' })
    }
    if (existing.authorId !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Cannot edit another account’s post',
        data: { code: 'forbidden' }
      })
    }
    await postRef.update({ text: post, updatedAt: now })
    return { success: true, key: postId }
  }

  const ownPosts = await db
    .ref('communityPosts')
    .orderByChild('authorId')
    .equalTo(userId)
    .once('value')
  const postsToday = Object.values(
    (ownPosts.val() ?? {}) as Record<string, { createdAt?: unknown }>
  ).filter(
    (existing) => typeof existing.createdAt === 'number' && existing.createdAt > now - DAY_MS
  ).length
  if (postsToday >= MAX_COMMUNITY_POSTS_PER_DAY) {
    throw createError({
      statusCode: 429,
      message: 'Daily post limit reached',
      data: { code: 'community-post-limit' }
    })
  }

  const postRef = db.ref('communityPosts').push()
  await postRef.set({
    authorId: userId,
    text: post,
    language: locale,
    createdAt: now,
    updatedAt: now,
    likes: 0,
    commentCount: 0
  })

  return { success: true, key: postRef.key }
})
