import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

// Posts, likes, post comments and community names, driven end to end through
// their routes.

installServerGlobals()

let fake = createFakeDatabase()
let currentUser = 'reader-1'
const deleteUser = vi.fn()

vi.mock(import('../server/utils/firebase-admin'), () => ({
  getAdminDatabase: () => fake.db,
  getAdminAuth: () => ({ deleteUser })
}))
vi.mock(import('../server/utils/auth'), () => ({
  getAuthenticatedUser: async () => currentUser
}))

type Route = (event: unknown) => Promise<Record<string, unknown>>
const createPost = (await import('../server/api/community-post/index.post'))
  .default as unknown as Route
const deletePost = (await import('../server/api/community-post/index.delete'))
  .default as unknown as Route
const likePost = (await import('../server/api/community-post/like.post'))
  .default as unknown as Route
const saveComment = (await import('../server/api/community-post/comment.post'))
  .default as unknown as Route
const deleteComment = (await import('../server/api/community-post/comment.delete'))
  .default as unknown as Route
const deleteAccount = (await import('../server/api/settings/delete-account.post'))
  .default as unknown as Route
const saveName = (await import('../server/api/community-profile.post')).default as unknown as Route
const markRead = (await import('../server/api/community-read.post')).default as unknown as Route

type Node = Record<string, Record<string, unknown>>
const posts = () => (fake.data.communityPosts ?? {}) as Node
const thread = (postId: string) =>
  ((fake.data.communityPostComments as Record<string, Node> | undefined)?.[postId] ?? {}) as Node

beforeEach(() => {
  currentUser = 'reader-1'
  fake = createFakeDatabase({
    communityPosts: {
      post1: { authorId: 'author-1', text: 'Hello', language: 'en', createdAt: 100, likes: 0 }
    }
  })
})

describe('community posts', () => {
  it('stores a trimmed post in the writer’s language', async () => {
    const result = await createPost(requestEvent({ post: '  Any rice cake tips?  ', locale: 'de' }))

    expect(posts()[result.key as string]).toMatchObject({
      authorId: 'reader-1',
      text: 'Any rice cake tips?',
      language: 'de',
      likes: 0,
      commentCount: 0
    })
  })

  it('lets only the author edit a post, without moving or counting it again', async () => {
    await expect(
      createPost(requestEvent({ postId: 'post1', post: 'Hijacked', locale: 'en' }))
    ).rejects.toMatchObject({ statusCode: 403 })

    currentUser = 'author-1'
    await createPost(requestEvent({ postId: 'post1', post: 'Hello again', locale: 'de' }))
    expect(posts().post1).toMatchObject({ text: 'Hello again', language: 'en', createdAt: 100 })
    expect(Object.keys(posts())).toEqual(['post1'])
  })

  it('stops at the daily limit without writing', async () => {
    const recent = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `own-${index}`,
        { authorId: 'reader-1', text: 'x', language: 'en', createdAt: Date.now() - 1000 }
      ])
    )
    fake = createFakeDatabase({ communityPosts: recent })

    await expect(
      createPost(requestEvent({ post: 'One more', locale: 'en' }))
    ).rejects.toMatchObject({ statusCode: 429, data: { code: 'community-post-limit' } })
    expect(Object.keys(posts())).toHaveLength(10)
  })

  it('likes once, ignores a repeat and unlikes', async () => {
    await likePost(requestEvent({ postId: 'post1', liked: true }))
    await likePost(requestEvent({ postId: 'post1', liked: true }))
    expect(posts().post1).toMatchObject({ likes: 1, likerIds: { 'reader-1': true } })

    await likePost(requestEvent({ postId: 'post1', liked: false }))
    expect(posts().post1!.likes).toBe(0)
    expect(posts().post1).not.toHaveProperty('likerIds')
  })

  it('does not let the author like their own post', async () => {
    currentUser = 'author-1'
    await expect(likePost(requestEvent({ postId: 'post1', liked: true }))).rejects.toMatchObject({
      statusCode: 403
    })
    expect(posts().post1!.likes).toBe(0)
  })

  it('keeps the comment count and activity in step with the thread', async () => {
    await saveComment(requestEvent({ postId: 'post1', comment: 'Try the plain ones' }))
    const [commentId] = Object.keys(thread('post1'))
    expect(posts().post1).toMatchObject({ commentCount: 1 })
    expect(posts().post1!.lastCommunityCommentAt).toEqual(expect.any(Number))

    currentUser = 'someone-else'
    await expect(deleteComment(requestEvent({ postId: 'post1', commentId }))).rejects.toMatchObject(
      { statusCode: 403 }
    )

    currentUser = 'reader-1'
    await deleteComment(requestEvent({ postId: 'post1', commentId }))
    expect(thread('post1')).toEqual({})
    expect(posts().post1).toMatchObject({ commentCount: 0 })
    expect(posts().post1).not.toHaveProperty('lastCommunityCommentAt')
  })

  it('lets only the author delete a post, together with its comments', async () => {
    await saveComment(requestEvent({ postId: 'post1', comment: 'Nice' }))

    await expect(deletePost(requestEvent({ postId: 'post1' }))).rejects.toMatchObject({
      statusCode: 403
    })

    currentUser = 'author-1'
    await deletePost(requestEvent({ postId: 'post1' }))
    expect(fake.data.communityPosts).toBeUndefined()
    expect(fake.data.communityPostComments).toBeUndefined()
  })

  it('removes the account’s posts, hidden ones too, its name and admin rights on deletion', async () => {
    await saveComment(requestEvent({ postId: 'post1', comment: 'Thanks' }))
    currentUser = 'author-1'
    await createPost(requestEvent({ post: 'Second post', locale: 'en' }))
    await saveName(requestEvent({ nickname: 'Anna' }))
    posts().post1!.hiddenAt = 500

    fake.data.admins = { 'author-1': true }

    await deleteAccount(requestEvent(undefined))
    expect(fake.data.communityPosts).toBeUndefined()
    expect(fake.data.communityPostComments).toBeUndefined()
    expect(fake.data.communityProfiles).toBeUndefined()
    expect(fake.data.communityNameKeys).toBeUndefined()
    expect(fake.data.admins).toBeUndefined()
    expect(deleteUser).toHaveBeenCalledWith('author-1')
  })

  it('removes the account’s comments on other posts, hidden ones too, and keeps likes', async () => {
    fake = createFakeDatabase({
      'reader-1': { communityThreads: { posts: { post1: 300, post2: 200 } } },
      communityPosts: {
        post1: {
          authorId: 'author-1',
          text: 'Hello',
          createdAt: 100,
          likes: 1,
          likerIds: { 'reader-1': true },
          commentCount: 3,
          hiddenCommentCount: 1,
          lastCommunityCommentAt: 300,
          lastAuthorCommentAt: 250
        }
      },
      communityPostComments: {
        post1: {
          c1: { type: 'comment', authorId: 'reader-1', text: 'Thanks', createdAt: 200 },
          c2: { type: 'comment', authorId: 'author-1', text: 'Welcome', createdAt: 250 },
          c3: { type: 'comment', authorId: 'reader-1', text: 'Again', createdAt: 300 },
          c4: {
            type: 'comment',
            authorId: 'reader-1',
            text: 'Hidden',
            createdAt: 350,
            hiddenAt: 400
          }
        }
      }
    })

    await deleteAccount(requestEvent(undefined))
    expect(Object.keys(thread('post1'))).toEqual(['c2'])
    expect(posts().post1).toMatchObject({
      commentCount: 1,
      hiddenCommentCount: 0,
      lastAuthorCommentAt: 250,
      likes: 1,
      likerIds: { 'reader-1': true }
    })
    expect(posts().post1).not.toHaveProperty('lastCommunityCommentAt')
    expect(fake.data['reader-1']).toBeUndefined()
  })
})

describe('community names', () => {
  it('stores a tidied name, claims it, and frees it when removed', async () => {
    await saveName(requestEvent({ nickname: '  Anna   Lena  ' }))
    expect(fake.data.communityProfiles).toEqual({
      'reader-1': { nickname: 'Anna Lena', updatedAt: expect.any(Number) }
    })
    expect(fake.data.communityNameKeys).toEqual({ annalena: 'reader-1' })

    await saveName(requestEvent({ nickname: 'Anna' }))
    expect(fake.data.communityNameKeys).toEqual({ anna: 'reader-1' })

    await saveName(requestEvent({ nickname: null }))
    expect(fake.data.communityProfiles).toBeUndefined()
    expect(fake.data.communityNameKeys).toBeUndefined()
  })

  it('keeps a name to one account, whatever its case, spacing or punctuation', async () => {
    await saveName(requestEvent({ nickname: 'Anna' }))

    currentUser = 'author-1'
    for (const nickname of ['anna', 'A n n a', 'Anna!', 'ＡＮＮＡ']) {
      await expect(saveName(requestEvent({ nickname }))).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'community-name-taken' }
      })
    }
    expect(Object.keys(fake.data.communityProfiles as object)).toEqual(['reader-1'])
  })

  it('refuses names that pass for the app, are too short or carry invisible characters', async () => {
    for (const nickname of [
      'PKU Tools',
      'pku-tools team',
      'Admin',
      'A',
      '\u200B\u200B\u200B',
      'An\u200Bna',
      'Anna\u202E'
    ]) {
      await expect(saveName(requestEvent({ nickname }))).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(fake.data.communityProfiles).toBeUndefined()
  })
})

describe('reading comments', () => {
  it('records when the owner opened their post’s comments, and only for the owner', async () => {
    await expect(markRead(requestEvent({ target: 'post', key: 'post1' }))).rejects.toMatchObject({
      statusCode: 403
    })
    expect(fake.data['reader-1']).toBeUndefined()

    currentUser = 'author-1'
    await markRead(requestEvent({ target: 'post', key: 'post1' }))
    expect(fake.data['author-1']).toEqual({
      communityReads: { posts: { post1: expect.any(Number) } }
    })

    await deletePost(requestEvent({ postId: 'post1' }))
    expect(fake.data['author-1']).toBeUndefined()
  })
})

describe('conversations a commenter joined', () => {
  it('records the thread with the comment and lets the commenter mark it read', async () => {
    await saveComment(requestEvent({ postId: 'post1', comment: 'Try the plain ones' }))
    expect(fake.data['reader-1']).toEqual({
      communityThreads: { posts: { post1: expect.any(Number) } }
    })

    await markRead(requestEvent({ target: 'post', key: 'post1' }))
    expect(fake.data['reader-1']).toMatchObject({
      communityReads: { posts: { post1: expect.any(Number) } }
    })
  })

  it('leaves the conversation when the commenter deletes their last comment there', async () => {
    await saveComment(requestEvent({ postId: 'post1', comment: 'First' }))
    await saveComment(requestEvent({ postId: 'post1', comment: 'Second' }))
    await markRead(requestEvent({ target: 'post', key: 'post1' }))
    const [first, second] = Object.keys(thread('post1'))

    await deleteComment(requestEvent({ postId: 'post1', commentId: first }))
    expect(fake.data['reader-1']).toMatchObject({
      communityThreads: { posts: { post1: expect.any(Number) } },
      communityReads: { posts: { post1: expect.any(Number) } }
    })

    await deleteComment(requestEvent({ postId: 'post1', commentId: second }))
    expect(fake.data['reader-1']).toBeUndefined()
  })

  it('does not record the author’s own thread', async () => {
    currentUser = 'author-1'
    await saveComment(requestEvent({ postId: 'post1', comment: 'Thanks!' }))
    expect(fake.data['author-1']).toBeUndefined()
  })
})
