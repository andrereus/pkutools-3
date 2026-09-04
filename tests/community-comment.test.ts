import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeDatabase,
  installServerGlobals,
  requestEvent,
  type WriteFailure
} from './helpers/server-harness'

// Public comments and the food's list-level summary are separate records. Drive
// create, edit and per-comment deletion end to end, including failed writes.

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({
  getAuthenticatedUser: async () => 'commenter-1'
}))

const saveComment = (await import('../server/api/community-food/comment.post'))
  .default as unknown as (event: unknown) => Promise<{ success: boolean }>
const deleteComment = (await import('../server/api/community-food/comment.delete'))
  .default as unknown as (event: unknown) => Promise<{ success: boolean }>

const seed = (data: Record<string, unknown> = {}, failWrite?: WriteFailure) => {
  fake = createFakeDatabase(
    {
      communityFoods: {
        food1: {
          name: 'Rice cake',
          contributorId: 'author-1',
          commentCount: 0
        }
      },
      ...data
    },
    failWrite
  )
}

const saveRequest = (comment: unknown = 'The Phe value may be per serving', commentId?: unknown) =>
  requestEvent({
    communityFoodKey: 'food1',
    comment,
    ...(commentId !== undefined && { commentId })
  })
const deleteRequest = (commentId: unknown) => requestEvent({ communityFoodKey: 'food1', commentId })
const food = () =>
  (fake.data.communityFoods as Record<string, Record<string, unknown>> | undefined)?.food1
const comments = () =>
  ((fake.data.communityFoodComments as Record<string, Record<string, unknown>> | undefined)
    ?.food1 ?? {}) as Record<string, Record<string, unknown>>

beforeEach(() => seed())

describe('community food comments', () => {
  it('appends a public comment and increments the summary count', async () => {
    const result = await saveComment(saveRequest('  Check the serving size.  '))

    const [commentId, stored] = Object.entries(comments())[0]!
    expect(stored).toMatchObject({
      authorId: 'commenter-1',
      text: 'Check the serving size.'
    })
    expect(stored.createdAt).toEqual(expect.any(Number))
    expect(stored.updatedAt).toBe(stored.createdAt)
    expect(food()).toMatchObject({ commentCount: 1 })
    expect(result).toEqual({ success: true })
    expect(commentId).toMatch(/^-Nfake/)
  })

  it('allows one account to add several chronological comments', async () => {
    await saveComment(saveRequest('First comment'))
    await saveComment(saveRequest('Follow-up comment'))

    expect(Object.values(comments())).toEqual([
      expect.objectContaining({ authorId: 'commenter-1', text: 'First comment' }),
      expect.objectContaining({ authorId: 'commenter-1', text: 'Follow-up comment' })
    ])
    expect(food()).toMatchObject({ commentCount: 2 })
  })

  it('counts concurrent submissions from the same account as separate comments', async () => {
    await Promise.all([
      saveComment(saveRequest('First submit')),
      saveComment(saveRequest('Second submit'))
    ])

    expect(Object.values(comments())).toHaveLength(2)
    expect(Object.values(comments())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'First submit' }),
        expect.objectContaining({ text: 'Second submit' })
      ])
    )
    expect(food()).toMatchObject({ commentCount: 2 })
  })

  it('rejects a new comment once the food has 100 comments', async () => {
    const existing = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        `comment-${index}`,
        {
          authorId: 'commenter-2',
          text: `Comment ${index}`,
          createdAt: index + 1,
          updatedAt: index + 1
        }
      ])
    )
    seed({
      communityFoods: {
        food1: { name: 'Rice cake', contributorId: 'author-1', commentCount: 100 }
      },
      communityFoodComments: { food1: existing }
    })

    await expect(saveComment(saveRequest('One too many'))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'community-food-comment-limit' }
    })
    expect(Object.keys(comments())).toHaveLength(100)
    expect(food()).toMatchObject({ commentCount: 100 })
  })

  it('edits only the selected own comment without changing its count or creation time', async () => {
    seed({
      communityFoods: {
        food1: { name: 'Rice cake', contributorId: 'author-1', commentCount: 2 }
      },
      communityFoodComments: {
        food1: {
          first: {
            authorId: 'commenter-1',
            text: 'Old text',
            createdAt: 100,
            updatedAt: 100
          },
          second: {
            authorId: 'commenter-1',
            text: 'Another comment',
            createdAt: 200,
            updatedAt: 200
          }
        }
      }
    })

    await expect(saveComment(saveRequest('Corrected text', 'first'))).resolves.toEqual({
      success: true
    })

    expect(comments().first).toMatchObject({
      authorId: 'commenter-1',
      text: 'Corrected text',
      createdAt: 100
    })
    expect(comments().first!.updatedAt).toBeGreaterThan(100)
    expect(comments().second).toMatchObject({ text: 'Another comment' })
    expect(food()).toMatchObject({ commentCount: 2 })
  })

  it('does not allow editing another account’s comment', async () => {
    seed({
      communityFoodComments: {
        food1: {
          other: { authorId: 'commenter-2', text: 'Other', createdAt: 100, updatedAt: 100 }
        }
      }
    })

    await expect(saveComment(saveRequest('Changed', 'other'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'forbidden' }
    })
    expect(comments().other).toMatchObject({ text: 'Other' })
  })

  it('allows the contributor to reply and then follow up again', async () => {
    seed({
      communityFoods: {
        food1: { name: 'Rice cake', contributorId: 'commenter-1', commentCount: 1 }
      },
      communityFoodComments: {
        food1: {
          feedback: {
            authorId: 'commenter-2',
            text: 'The value may be per serving.',
            createdAt: 100,
            updatedAt: 100
          }
        }
      }
    })

    await saveComment(saveRequest('The package states that it is per 100 g.'))
    await saveComment(saveRequest('I can add a package photo as well.'))

    expect(Object.values(comments()).filter((item) => item.authorId === 'commenter-1')).toEqual([
      expect.objectContaining({ text: 'The package states that it is per 100 g.' }),
      expect.objectContaining({ text: 'I can add a package photo as well.' })
    ])
    expect(food()).toMatchObject({ commentCount: 3 })
  })

  it('deletes only the selected own comment and decrements once', async () => {
    seed({
      communityFoods: {
        food1: { name: 'Rice cake', contributorId: 'author-1', commentCount: 3 }
      },
      communityFoodComments: {
        food1: {
          first: { authorId: 'commenter-1', text: 'First', createdAt: 100, updatedAt: 100 },
          second: { authorId: 'commenter-1', text: 'Second', createdAt: 200, updatedAt: 200 },
          other: { authorId: 'commenter-2', text: 'Other', createdAt: 300, updatedAt: 300 }
        }
      }
    })

    await expect(deleteComment(deleteRequest('second'))).resolves.toEqual({ success: true })

    expect(comments()).toEqual({
      first: { authorId: 'commenter-1', text: 'First', createdAt: 100, updatedAt: 100 },
      other: { authorId: 'commenter-2', text: 'Other', createdAt: 300, updatedAt: 300 }
    })
    expect(food()).toMatchObject({ commentCount: 2 })
  })

  it('does not allow deleting another account’s comment', async () => {
    seed({
      communityFoods: {
        food1: { name: 'Rice cake', contributorId: 'author-1', commentCount: 1 }
      },
      communityFoodComments: {
        food1: {
          other: { authorId: 'commenter-2', text: 'Other', createdAt: 100, updatedAt: 100 }
        }
      }
    })

    await expect(deleteComment(deleteRequest('other'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'forbidden' }
    })
    expect(comments().other).toMatchObject({ text: 'Other' })
    expect(food()).toMatchObject({ commentCount: 1 })
  })

  it('makes deleting an already missing comment idempotent', async () => {
    await expect(deleteComment(deleteRequest('missing'))).resolves.toEqual({ success: true })
    expect(food()).toMatchObject({ commentCount: 0 })
  })

  it('rejects blank, overlong and path-like inputs before writing', async () => {
    for (const body of [
      { communityFoodKey: 'food1', comment: '   ' },
      { communityFoodKey: 'food1', comment: 'x'.repeat(301) },
      { communityFoodKey: '../food1', comment: 'Text' },
      { communityFoodKey: 'food1', commentId: '../comment', comment: 'Text' }
    ]) {
      await expect(saveComment(requestEvent(body))).rejects.toMatchObject({ statusCode: 400 })
    }
    await expect(deleteComment(deleteRequest('../comment'))).rejects.toMatchObject({
      statusCode: 400
    })
    expect(fake.data.communityFoodComments).toBeUndefined()
    expect(food()).toMatchObject({ commentCount: 0 })
  })

  it('404s when the community food no longer exists', async () => {
    seed({ communityFoods: {} })

    await expect(saveComment(saveRequest())).rejects.toMatchObject({ statusCode: 404 })
    expect(fake.data.communityFoodComments).toBeUndefined()
  })

  it('writes neither comment nor count when the atomic create fails', async () => {
    seed({}, (operation, path) => operation === 'update' && path === '')

    await expect(saveComment(saveRequest())).rejects.toMatchObject({ statusCode: 500 })
    expect(fake.data.communityFoodComments).toBeUndefined()
    expect(food()).toMatchObject({ commentCount: 0 })
  })

  it('writes neither deletion nor count when the atomic delete fails', async () => {
    seed(
      {
        communityFoods: {
          food1: { name: 'Rice cake', contributorId: 'author-1', commentCount: 1 }
        },
        communityFoodComments: {
          food1: {
            own: {
              authorId: 'commenter-1',
              text: 'Keep me on failure',
              createdAt: 100,
              updatedAt: 100
            }
          }
        }
      },
      (operation, path) => operation === 'update' && path === ''
    )

    await expect(deleteComment(deleteRequest('own'))).rejects.toMatchObject({ statusCode: 500 })
    expect(comments().own).toMatchObject({ text: 'Keep me on failure' })
    expect(food()).toMatchObject({ commentCount: 1 })
  })

  it('deletes an orphaned own comment without recreating a missing food', async () => {
    seed({
      communityFoods: {},
      communityFoodComments: {
        food1: {
          orphan: {
            authorId: 'commenter-1',
            text: 'Orphaned comment',
            createdAt: 100,
            updatedAt: 100
          }
        }
      }
    })

    await expect(deleteComment(deleteRequest('orphan'))).resolves.toEqual({ success: true })
    expect(fake.data.communityFoods).toEqual({})
    expect(fake.data.communityFoodComments).toBeUndefined()
  })
})
