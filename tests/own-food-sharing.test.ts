import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createFakeDatabase,
  installServerGlobals,
  requestEvent,
  type WriteFailure
} from './helpers/server-harness'

// Editing an own food can publish it to the community, withdraw it, or change a
// food other people have already voted on. Those transitions decide what the
// whole community sees, and each one writes to a different place.

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'owner-1' }))

const updateOwnFood = (await import('../server/api/own-food/update.post')).default as unknown as (
  event: unknown
) => Promise<{ key: string; communityKey: string | null }>

const OWN_FOOD = { name: 'Protein shake', phe: 12, kcal: 90, note: null, shared: false }

const seed = (
  ownFood: Record<string, unknown>,
  communityFoods: Record<string, unknown> = {},
  failWrite?: WriteFailure
) => {
  fake = createFakeDatabase(
    { 'owner-1': { ownFood: { entry1: ownFood } }, communityFoods },
    failWrite
  )
}

const community = () => fake.data.communityFoods as Record<string, Record<string, unknown>>
const storedOwnFood = () =>
  (fake.data['owner-1'] as { ownFood: Record<string, Record<string, unknown>> }).ownFood.entry1!

const request = (data: Record<string, unknown>) =>
  requestEvent({ entryKey: 'entry1', locale: 'en', data: { ...OWN_FOOD, ...data } })

beforeEach(() => {
  seed({ ...OWN_FOOD })
})

describe('sharing an own food', () => {
  it('publishes a community entry with zeroed votes', async () => {
    const result = await updateOwnFood(request({ shared: true }))

    const [publishedKey, published] = Object.entries(community())[0]!
    expect(published).toMatchObject({
      name: 'Protein shake',
      phe: 12,
      kcal: 90,
      language: 'en',
      contributorId: 'owner-1',
      ownFoodKey: 'entry1',
      likes: 0,
      dislikes: 0,
      score: 0,
      usageCount: 0
    })
    // The own food keeps a pointer back, so a later edit finds the same entry.
    expect(storedOwnFood().communityKey).toBe(publishedKey)
    expect(result.communityKey).toBe(publishedKey)
  })

  it('refuses to publish a duplicate of an existing community food', async () => {
    seed(
      { ...OWN_FOOD },
      {
        other: { name: 'protein SHAKE', phe: 12, language: 'en', likes: 0, dislikes: 0 }
      }
    )

    await expect(updateOwnFood(request({ shared: true }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'duplicate-community-food' }
    })
    expect(Object.keys(community())).toEqual(['other'])
  })

  // A food the community already buried must not block a fresh submission.
  it('publishes even when the only match is a hidden food', async () => {
    seed(
      { ...OWN_FOOD },
      {
        buried: { name: 'Protein shake', phe: 12, language: 'en', likes: 0, dislikes: 9 }
      }
    )

    await updateOwnFood(request({ shared: true }))

    expect(Object.keys(community())).toHaveLength(2)
  })

  it('treats a food in another language as a separate entry', async () => {
    seed(
      { ...OWN_FOOD },
      {
        german: { name: 'Protein shake', phe: 12, language: 'de', likes: 0, dislikes: 0 }
      }
    )

    await updateOwnFood(request({ shared: true }))

    expect(Object.keys(community())).toHaveLength(2)
  })
})

describe('unsharing an own food', () => {
  it('removes the community entry and clears the pointer', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: { name: 'Protein shake', phe: 12, contributorId: 'owner-1' }
      }
    )

    const result = await updateOwnFood(request({ shared: false }))

    expect(community().community1).toBeUndefined()
    expect(result.communityKey).toBeNull()
    // Firebase deletes a child written as null, so the field is gone from the
    // record rather than present and null — what the client's listener sees.
    expect(storedOwnFood()).not.toHaveProperty('communityKey')
  })
})

describe('editing an already shared food', () => {
  const seedShared = () =>
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: {
          name: 'Protein shake',
          phe: 12,
          kcal: 90,
          likes: 5,
          dislikes: 1,
          score: 4,
          voterIds: { 'voter-1': 1 }
        }
      }
    )

  // Votes endorse a specific set of numbers. Once those change the endorsement
  // no longer applies, so the score has to start over.
  it('resets the votes when the phe value changes', async () => {
    seedShared()

    await updateOwnFood(request({ shared: true, phe: 20 }))

    expect(community().community1).toMatchObject({ phe: 20, likes: 0, dislikes: 0, score: 0 })
    expect(community().community1!.voterIds).toBeUndefined()
  })

  it('resets the votes when the name or kcal changes', async () => {
    seedShared()
    await updateOwnFood(request({ shared: true, name: 'Protein shake XL' }))
    expect(community().community1).toMatchObject({ name: 'Protein shake XL', score: 0 })

    seedShared()
    await updateOwnFood(request({ shared: true, kcal: 120 }))
    expect(community().community1).toMatchObject({ kcal: 120, score: 0 })
  })

  // An edit that leaves the numbers alone must not wipe hard-earned votes.
  it('keeps the votes when only the note changes', async () => {
    seedShared()

    await updateOwnFood(request({ shared: true, note: 'Mixed with water' }))

    expect(community().community1).toMatchObject({
      note: 'Mixed with water',
      likes: 5,
      dislikes: 1,
      score: 4
    })
    expect(community().community1!.voterIds).toEqual({ 'voter-1': 1 })
  })
})

// Sharing writes to two places that are not in one transaction: the community
// entry, then the own food that points at it. These pin what a caller sees when
// the second write fails, and what is left behind in the database.
describe('when a database write fails midway', () => {
  const failOwnFoodWrite: WriteFailure = (operation, path) =>
    operation === 'update' && path.includes('/ownFood/')

  it('surfaces the failure as a 500 rather than reporting success', async () => {
    seed({ ...OWN_FOOD }, {}, failOwnFoodWrite)

    await expect(updateOwnFood(request({ shared: true }))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Internal server error'
    })
  })

  it('leaves the own food untouched when its write is the one that fails', async () => {
    seed({ ...OWN_FOOD }, {}, failOwnFoodWrite)

    await updateOwnFood(request({ shared: true, name: 'Renamed' })).catch(() => {})

    expect(storedOwnFood()).toMatchObject({ name: 'Protein shake', shared: false })
    expect(storedOwnFood()).not.toHaveProperty('communityKey')
  })

  // The community entry is written first and nothing rolls it back, so it
  // outlives the failed request — an entry whose ownFoodKey points at a food
  // that does not consider itself shared. Recorded, not endorsed: if rollback
  // or a transaction is added, this expectation should flip to an empty map.
  it('currently leaves the published community entry behind', async () => {
    seed({ ...OWN_FOOD }, {}, failOwnFoodWrite)

    await updateOwnFood(request({ shared: true })).catch(() => {})

    const orphans = Object.values(community())
    expect(orphans).toHaveLength(1)
    expect(orphans[0]).toMatchObject({ ownFoodKey: 'entry1', contributorId: 'owner-1' })
  })

  it('keeps the community entry when unsharing fails to remove it', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      { community1: { name: 'Protein shake', phe: 12, contributorId: 'owner-1' } },
      (operation) => operation === 'remove'
    )

    await expect(updateOwnFood(request({ shared: false }))).rejects.toMatchObject({
      statusCode: 500
    })
    // The own food must still say shared, matching the entry that is still live.
    expect(community().community1).toBeDefined()
    expect(storedOwnFood().shared).toBe(true)
  })
})

describe('own food update guards', () => {
  it('404s on an entry the user does not have', async () => {
    await expect(
      updateOwnFood(requestEvent({ entryKey: 'nope', locale: 'en', data: OWN_FOOD }))
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('preserves the original createdAt and refreshes updatedAt', async () => {
    seed({ ...OWN_FOOD, createdAt: 1700000000000 })

    await updateOwnFood(request({ name: 'Renamed' }))

    expect(storedOwnFood().createdAt).toBe(1700000000000)
    expect(storedOwnFood().updatedAt).toBeGreaterThan(1700000000000)
  })
})
