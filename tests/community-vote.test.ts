import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createFakeDatabase,
  installServerGlobals,
  requestEvent,
  ServerValueStub,
  type WriteFailure
} from './helpers/server-harness'

// Voting is the only way the community can correct a bad food entry, and the
// like/dislike bookkeeping has three branches (new vote, same vote again,
// switched vote) that all write to the same counters.

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({
  getAdminDatabase: () => fake.db
}))
vi.mock(import('firebase-admin/database'), () => ({ ServerValue: ServerValueStub }))
vi.mock(import('../server/utils/auth'), () => ({
  getAuthenticatedUser: async () => 'voter-1'
}))

const vote = (await import('../server/api/community-food/vote.post')).default as unknown as (
  event: unknown
) => Promise<{ likes: number; dislikes: number; score: number; hidden: boolean }>

const seedFood = (overrides: Record<string, unknown> = {}, failWrite?: WriteFailure) => {
  fake = createFakeDatabase(
    {
      communityFoods: {
        food1: {
          name: 'Rice cake',
          phe: 60,
          contributorId: 'author-1',
          likes: 0,
          dislikes: 0,
          score: 0,
          ...overrides
        }
      }
    },
    failWrite
  )
}

const storedFood = () => (fake.data.communityFoods as Record<string, Record<string, unknown>>).food1

beforeEach(() => {
  seedFood()
})

describe('community food vote', () => {
  // Every branch of the like/dislike bookkeeping, in both directions. Each case
  // starts from 2 likes / 2 dislikes so a counter moving the wrong way — or not
  // moving at all — shows up in the totals. Casting the same vote twice is the
  // UI's "undo"; switching sides has to move both counters, or the stored score
  // drifts away from likes - dislikes and a food can end up hidden on a score
  // nobody actually cast.
  it.each([
    ['casts a new like', undefined, 1, { likes: 3, dislikes: 2, score: 1 }, { 'voter-1': 1 }],
    ['casts a new dislike', undefined, -1, { likes: 2, dislikes: 3, score: -1 }, { 'voter-1': -1 }],
    ['undoes a like', 1, 1, { likes: 1, dislikes: 2, score: -1 }, undefined],
    ['undoes a dislike', -1, -1, { likes: 2, dislikes: 1, score: 1 }, undefined],
    ['switches dislike to like', -1, 1, { likes: 3, dislikes: 1, score: 2 }, { 'voter-1': 1 }],
    ['switches like to dislike', 1, -1, { likes: 1, dislikes: 3, score: -2 }, { 'voter-1': -1 }]
  ])('%s', async (_label, existingVote, newVote, expected, expectedVoters) => {
    seedFood({
      likes: 2,
      dislikes: 2,
      score: 0,
      ...(existingVote !== undefined && { voterIds: { 'voter-1': existingVote } })
    })

    const result = await vote(requestEvent({ communityFoodKey: 'food1', vote: newVote }))

    expect(storedFood()).toMatchObject(expected)
    expect(storedFood().voterIds).toEqual(expectedVoters)
    // The optimistic response the UI shows must agree with what was stored.
    expect(result).toMatchObject(expected)
  })

  it('reports a food as hidden once it reaches three net dislikes', async () => {
    seedFood({ likes: 0, dislikes: 2, score: -2 })

    const result = await vote(requestEvent({ communityFoodKey: 'food1', vote: -1 }))

    expect(result).toMatchObject({ score: -3, hidden: true })
  })

  it('lets a reader reconsider their vote and restore a hidden food to search', async () => {
    seedFood({ likes: 0, dislikes: 3, score: -3, voterIds: { 'voter-1': -1 } })

    const result = await vote(requestEvent({ communityFoodKey: 'food1', vote: 1 }))

    expect(result).toMatchObject({ likes: 1, dislikes: 2, score: -1, hidden: false })
    expect(storedFood()).toMatchObject({
      likes: 1,
      dislikes: 2,
      score: -1,
      voterIds: { 'voter-1': 1 }
    })
  })

  // Otherwise a contributor could lift their own entry above the hide threshold.
  it('refuses a vote on the voter’s own contribution', async () => {
    seedFood({ contributorId: 'voter-1' })

    await expect(vote(requestEvent({ communityFoodKey: 'food1', vote: 1 }))).rejects.toMatchObject({
      statusCode: 403
    })
    expect(storedFood()).toMatchObject({ likes: 0, score: 0 })
  })

  it('404s on a food that does not exist', async () => {
    await expect(
      vote(requestEvent({ communityFoodKey: 'missing', vote: 1 }))
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects an out-of-range vote weight', async () => {
    await expect(vote(requestEvent({ communityFoodKey: 'food1', vote: 5 }))).rejects.toMatchObject({
      statusCode: 400
    })
    expect(storedFood()).toMatchObject({ likes: 0, dislikes: 0, score: 0 })
  })

  // A vote is also two writes: the voter record, then the counters. Recorded,
  // not endorsed — if the two are ever made atomic, this should assert the voter
  // record was rolled back too.
  it('reports a 500 when the counter write fails, leaving the voter recorded', async () => {
    seedFood({}, (operation, path) => operation === 'update' && path === 'communityFoods/food1')

    await expect(vote(requestEvent({ communityFoodKey: 'food1', vote: 1 }))).rejects.toMatchObject({
      statusCode: 500
    })

    expect(storedFood()).toMatchObject({ likes: 0, dislikes: 0, score: 0 })
    expect(storedFood().voterIds).toEqual({ 'voter-1': 1 })
  })
})
