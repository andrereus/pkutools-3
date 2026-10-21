import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

// Admin hiding and deleting. Admin rights come from `admins/<uid>` in the
// database; hidden content stays in place with `hiddenAt`.

installServerGlobals()

let fake = createFakeDatabase()
let currentUser = 'admin-1'

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({
  getAuthenticatedUser: async () => currentUser
}))

type Route = (event: unknown) => Promise<Record<string, unknown>>
const deletePost = (await import('../server/api/admin/community-post.delete'))
  .default as unknown as Route
const deleteFood = (await import('../server/api/admin/community-food.delete'))
  .default as unknown as Route
const deleteComment = (await import('../server/api/admin/comment.delete'))
  .default as unknown as Route
const deleteName = (await import('../server/api/admin/community-profile.delete'))
  .default as unknown as Route
const setHidden = (await import('../server/api/admin/hide.post')).default as unknown as Route
const saveComment = (await import('../server/api/community-post/comment.post'))
  .default as unknown as Route
const likePost = (await import('../server/api/community-post/like.post'))
  .default as unknown as Route

type Node = Record<string, Record<string, unknown>>
const posts = () => (fake.data.communityPosts ?? {}) as Node
const foods = () => (fake.data.communityFoods ?? {}) as Node

beforeEach(() => {
  currentUser = 'admin-1'
  fake = createFakeDatabase({
    admins: { 'admin-1': true },
    'user-1': {
      ownFood: { own1: { name: 'Rice cake', shared: true, communityKey: 'food1' } }
    },
    'user-2': { readState: { foods: { food1: { lastReadAt: 100, lastOtherCommentAt: 0 } } } },
    communityFoods: {
      food1: {
        name: 'Rice cake',
        contributorId: 'user-1',
        ownFoodKey: 'own1',
        language: 'en',
        commentCount: 1,
        lastCommunityCommentAt: 100
      }
    },
    communityFoodComments: {
      food1: {
        c1: { type: 'comment', authorId: 'user-2', text: 'Spam', createdAt: 100 },
        h1: { type: 'content-update', changedFields: ['phe'], createdAt: 50 }
      }
    },
    communityPosts: {
      post1: { authorId: 'user-2', text: 'Spam', language: 'en', createdAt: 100, likes: 0 }
    },
    communityPostComments: { post1: { c1: { authorId: 'user-1', text: 'Hi', createdAt: 200 } } },
    communityProfiles: {
      'user-2': { communityName: 'Spammer', updatedAt: 100 }
    }
  })
})

describe('admin routes', () => {
  it('refuse every account that is not listed as admin', async () => {
    currentUser = 'user-1'
    const before = structuredClone(fake.data)

    for (const request of [
      () => deletePost(requestEvent({ postId: 'post1' })),
      () => deleteFood(requestEvent({ communityFoodKey: 'food1' })),
      () => deleteComment(requestEvent({ target: 'post', parentKey: 'post1', commentId: 'c1' })),
      () => deleteName(requestEvent({ userId: 'user-2' })),
      () => setHidden(requestEvent({ target: 'post', key: 'post1', hidden: true }))
    ]) {
      await expect(request()).rejects.toMatchObject({ statusCode: 403 })
    }
    expect(fake.data).toEqual(before)
  })

  it('removes a community name', async () => {
    await deleteName(requestEvent({ userId: 'user-2' }))
    expect(fake.data.communityProfiles).toBeUndefined()
  })

  it('deletes a post with its comments', async () => {
    await deletePost(requestEvent({ postId: 'post1' }))
    expect(fake.data.communityPosts).toBeUndefined()
    expect(fake.data.communityPostComments).toBeUndefined()
  })

  it('deletes a food and its comments and leaves the own food unshared', async () => {
    await deleteFood(requestEvent({ communityFoodKey: 'food1' }))
    expect(fake.data.communityFoods).toBeUndefined()
    expect(fake.data.communityFoodComments).toBeUndefined()
    expect((fake.data['user-1'] as Record<string, unknown>).ownFood).toEqual({
      own1: { name: 'Rice cake', shared: false }
    })
    expect(fake.data['user-2']).toBeUndefined()
  })

  it('deletes one comment and its count, but never edit history', async () => {
    await deleteComment(requestEvent({ target: 'food', parentKey: 'food1', commentId: 'c1' }))
    expect(Object.keys((fake.data.communityFoodComments as Record<string, object>).food1)).toEqual([
      'h1'
    ])
    expect(foods().food1).toMatchObject({ commentCount: 0 })

    await expect(
      deleteComment(requestEvent({ target: 'food', parentKey: 'food1', commentId: 'h1' }))
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('hiding', () => {
  it('hides a post in place and shows it again', async () => {
    await setHidden(requestEvent({ target: 'post', key: 'post1', hidden: true }))
    expect(posts().post1).toMatchObject({ text: 'Spam', hiddenAt: expect.any(Number) })

    await setHidden(requestEvent({ target: 'post', key: 'post1', hidden: false }))
    expect(posts().post1).not.toHaveProperty('hiddenAt')
  })

  it('moves a hidden comment from the comment count to the hidden one, and back', async () => {
    const request = (hidden: boolean) =>
      setHidden(requestEvent({ target: 'food', key: 'food1', commentId: 'c1', hidden }))

    await request(true)
    await request(true)
    expect(foods().food1).toMatchObject({ commentCount: 0, hiddenCommentCount: 1 })
    expect(foods().food1).not.toHaveProperty('lastCommunityCommentAt')

    await request(false)
    expect(foods().food1).toMatchObject({
      commentCount: 1,
      hiddenCommentCount: 0,
      lastCommunityCommentAt: 100
    })
    expect((fake.data.communityFoodComments as Record<string, Node>).food1!.c1).not.toHaveProperty(
      'hiddenAt'
    )
  })

  it('takes a deleted hidden comment out of the hidden count only', async () => {
    await setHidden(requestEvent({ target: 'food', key: 'food1', commentId: 'c1', hidden: true }))
    await deleteComment(requestEvent({ target: 'food', parentKey: 'food1', commentId: 'c1' }))
    expect(foods().food1).toMatchObject({ commentCount: 0, hiddenCommentCount: 0 })
  })

  it('keeps hidden content out of reach for everyone but its owner and admins', async () => {
    await setHidden(requestEvent({ target: 'post', key: 'post1', hidden: true }))

    currentUser = 'user-3'
    await expect(likePost(requestEvent({ postId: 'post1', liked: true }))).rejects.toMatchObject({
      statusCode: 404
    })
    await expect(
      saveComment(requestEvent({ postId: 'post1', comment: 'Hello?' }))
    ).rejects.toMatchObject({ statusCode: 404 })

    currentUser = 'user-2'
    await saveComment(requestEvent({ postId: 'post1', comment: 'Still mine' }))
    expect(posts().post1).toMatchObject({ commentCount: 1 })
  })
})
