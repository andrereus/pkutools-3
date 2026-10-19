import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'
import { REMOVED_CONTENT_RETENTION_MS } from '../shared/utils/moderation'

// Admin removals, restores and permanent deletion. Admin rights come from
// `admins/<uid>` in the database; removed content waits in `removedContent`.

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
const restore = (await import('../server/api/admin/removed/restore.post'))
  .default as unknown as Route
const deleteRemoved = (await import('../server/api/admin/removed/index.delete'))
  .default as unknown as Route
const purge = (await import('../server/api/admin/removed/purge.post')).default as unknown as Route

type Node = Record<string, Record<string, unknown>>
const removed = () => (fake.data.removedContent ?? {}) as Node
const onlyRemovedId = () => {
  const ids = Object.keys(removed())
  expect(ids).toHaveLength(1)
  return ids[0]!
}

const initialData = {
  admins: { 'admin-1': true },
  'user-1': {
    ownFood: { own1: { name: 'Rice cake', shared: true, communityKey: 'food1' } }
  },
  communityFoods: {
    food1: {
      name: 'Rice cake',
      contributorId: 'user-1',
      ownFoodKey: 'own1',
      language: 'en',
      commentCount: 1
    }
  },
  communityFoodComments: {
    food1: {
      c1: { type: 'comment', authorId: 'user-2', text: 'Spam', createdAt: 100 },
      h1: { type: 'content-update', changedFields: ['phe'], createdAt: 50 }
    }
  },
  communityPosts: { post1: { authorId: 'user-2', text: 'Spam', language: 'en', createdAt: 100 } },
  communityPostComments: { post1: { c1: { authorId: 'user-1', text: 'Hi', createdAt: 200 } } },
  communityProfiles: { 'user-2': { nickname: 'Spammer', updatedAt: 100 } }
}

beforeEach(() => {
  currentUser = 'admin-1'
  fake = createFakeDatabase(initialData)
})

describe('admin routes', () => {
  it('refuse every account that is not listed as admin', async () => {
    currentUser = 'user-1'
    fake.data.removedContent = { r1: { type: 'post', key: 'post2', removedAt: Date.now() } }
    const before = structuredClone(fake.data)

    for (const request of [
      () => deletePost(requestEvent({ postId: 'post1' })),
      () => deleteFood(requestEvent({ communityFoodKey: 'food1' })),
      () => deleteComment(requestEvent({ target: 'post', parentKey: 'post1', commentId: 'c1' })),
      () => deleteName(requestEvent({ userId: 'user-2' })),
      () => restore(requestEvent({ removedId: 'r1' })),
      () => deleteRemoved(requestEvent({ removedId: 'r1' })),
      () => purge(requestEvent(undefined))
    ]) {
      await expect(request()).rejects.toMatchObject({ statusCode: 403 })
    }
    expect(fake.data).toEqual(before)
  })

  it('removes a community name', async () => {
    await deleteName(requestEvent({ userId: 'user-2' }))
    expect(fake.data.communityProfiles).toBeUndefined()
  })

  it('removes a post with its comments and restores both', async () => {
    await deletePost(requestEvent({ postId: 'post1' }))
    expect(fake.data.communityPosts).toBeUndefined()
    expect(fake.data.communityPostComments).toBeUndefined()
    expect(removed()[onlyRemovedId()]).toMatchObject({
      type: 'post',
      authorId: 'user-2',
      removedBy: 'admin-1'
    })

    await restore(requestEvent({ removedId: onlyRemovedId() }))
    expect(fake.data).toEqual(initialData)
  })

  it('unshares a removed food and shares it again on restore', async () => {
    await deleteFood(requestEvent({ communityFoodKey: 'food1' }))
    expect(fake.data.communityFoods).toBeUndefined()
    expect(fake.data.communityFoodComments).toBeUndefined()
    expect((fake.data['user-1'] as Record<string, unknown>).ownFood).toEqual({
      own1: { name: 'Rice cake', shared: false }
    })

    await restore(requestEvent({ removedId: onlyRemovedId() }))
    expect(fake.data).toEqual(initialData)
  })

  it('does not restore a food whose own food is gone, and changes nothing', async () => {
    await deleteFood(requestEvent({ communityFoodKey: 'food1' }))
    delete (fake.data['user-1'] as Record<string, unknown>).ownFood
    const before = structuredClone(fake.data)

    await expect(restore(requestEvent({ removedId: onlyRemovedId() }))).rejects.toMatchObject({
      statusCode: 409
    })
    expect(fake.data).toEqual(before)
  })

  it('does not create an own food when the pointer leads nowhere', async () => {
    delete (fake.data['user-1'] as Record<string, unknown>).ownFood
    await deleteFood(requestEvent({ communityFoodKey: 'food1' }))
    expect(fake.data['user-1']).toEqual({})
  })

  it('removes one comment with its count, restores it, and never touches edit history', async () => {
    await deleteComment(requestEvent({ target: 'food', parentKey: 'food1', commentId: 'c1' }))
    const threads = () => fake.data.communityFoodComments as Record<string, Node>
    const food = () => (fake.data.communityFoods as Node).food1
    expect(Object.keys(threads().food1!)).toEqual(['h1'])
    expect(food()).toMatchObject({ commentCount: 0 })
    expect(removed()[onlyRemovedId()]).toMatchObject({
      type: 'comment',
      parentTitle: 'Rice cake',
      language: 'en'
    })

    await restore(requestEvent({ removedId: onlyRemovedId() }))
    expect(threads().food1).toEqual(initialData.communityFoodComments.food1)
    expect(food()).toMatchObject({ commentCount: 1, lastCommunityCommentAt: 100 })
    expect(fake.data.removedContent).toBeUndefined()

    await expect(
      deleteComment(requestEvent({ target: 'food', parentKey: 'food1', commentId: 'h1' }))
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('deletes removed content permanently, and on its own once it expires', async () => {
    await deletePost(requestEvent({ postId: 'post1' }))
    await deleteRemoved(requestEvent({ removedId: onlyRemovedId() }))
    expect(fake.data.removedContent).toBeUndefined()

    fake.data.removedContent = {
      old: { type: 'post', key: 'x', removedAt: Date.now() - REMOVED_CONTENT_RETENTION_MS - 1 },
      recent: { type: 'post', key: 'y', removedAt: Date.now() }
    }
    await purge(requestEvent(undefined))
    expect(Object.keys(removed())).toEqual(['recent'])
  })
})
