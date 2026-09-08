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
  const linkedCommunityFoods = Object.fromEntries(
    Object.entries(communityFoods).map(([key, food]) => [
      key,
      key === ownFood.communityKey && typeof food === 'object' && food !== null
        ? { contributorId: 'owner-1', ownFoodKey: 'entry1', ...food }
        : food
    ])
  )
  fake = createFakeDatabase(
    { 'owner-1': { ownFood: { entry1: ownFood } }, communityFoods: linkedCommunityFoods },
    failWrite
  )
}

const community = () => fake.data.communityFoods as Record<string, Record<string, unknown>>
const communityComments = () =>
  (fake.data.communityFoodComments ?? {}) as Record<string, Record<string, unknown>>
const storedOwnFood = () =>
  (fake.data['owner-1'] as { ownFood: Record<string, Record<string, unknown>> }).ownFood.entry1!

const request = (data: Record<string, unknown>) =>
  requestEvent({ entryKey: 'entry1', locale: 'en', data: { ...OWN_FOOD, ...data } })

beforeEach(() => {
  seed({ ...OWN_FOOD })
})

describe('sharing an own food', () => {
  it('publishes a community entry with zeroed votes', async () => {
    let clock = 200
    vi.spyOn(Date, 'now').mockImplementation(() => clock++)
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
      usageCount: 0,
      commentCount: 0
    })
    // The own food keeps a pointer back, so a later edit finds the same entry.
    expect(storedOwnFood().communityKey).toBe(publishedKey)
    expect(result.communityKey).toBe(publishedKey)
    expect(published.contentUpdatedAt).toBe(published.createdAt)
    expect(published.updatedAt).toBe(published.createdAt)
    expect(storedOwnFood().updatedAt).toBe(published.updatedAt)
    expect(fake.data.communityFoodComments).toBeUndefined()
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

  it('matches a community duplicate whose legacy Phe value is stored as a string', async () => {
    seed(
      { ...OWN_FOOD },
      {
        other: { name: 'protein SHAKE', phe: '12', language: 'en', likes: 0, dislikes: 0 }
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
        buried: { name: 'Protein shake', phe: 12, language: 'en', likes: 0, dislikes: 3 }
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

  // Publishing refuses a duplicate, so renaming a published food onto another
  // one has to be refused too — otherwise it is simply the way around the check.
  it('refuses to rename a published food onto an existing one', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: { name: 'Protein shake', phe: 12, kcal: 90, language: 'en', likes: 4 },
        other: { name: 'Breakfast bar', phe: 30, language: 'en', likes: 0, dislikes: 0 }
      }
    )

    await expect(
      updateOwnFood(request({ shared: true, name: 'Breakfast bar', phe: 30 }))
    ).rejects.toMatchObject({ statusCode: 409, data: { code: 'duplicate-community-food' } })
    // Neither copy is touched: the votes on the published food survive the
    // rejected edit, and the food it collided with is untouched.
    expect(community().community1).toMatchObject({ name: 'Protein shake', phe: 12, likes: 4 })
    expect(storedOwnFood()).toMatchObject({ name: 'Protein shake', phe: 12 })
  })

  // The duplicate rule is per language, and a published food keeps the language
  // it was published in even after the user switches the app to another one.
  it('compares against the language the food was published in', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: { name: 'Protein shake', phe: 12, kcal: 90, language: 'de', likes: 0 },
        english: { name: 'Breakfast bar', phe: 30, language: 'en', likes: 0, dislikes: 0 }
      }
    )

    // Request locale is 'en', but the food lives in the German set — the
    // English entry is not its duplicate.
    await updateOwnFood(request({ shared: true, name: 'Breakfast bar', phe: 30 }))

    expect(community().community1).toMatchObject({ name: 'Breakfast bar', phe: 30 })
  })
})

// The same rule as on save: same name (case-insensitive) and the same Phe.
// Saving guards against making a second copy; this guards against editing one
// food into a copy of another.
describe('editing an own food into a duplicate', () => {
  const seedTwo = () => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: {
          entry1: { ...OWN_FOOD },
          entry2: { name: 'Breakfast bar', phe: 30, kcal: 210, shared: false }
        }
      },
      communityFoods: {}
    })
  }

  it('refuses an edit that collides with another own food', async () => {
    seedTwo()

    await expect(updateOwnFood(request({ name: 'breakfast BAR', phe: 30 }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'duplicate-own-food' }
    })
    expect(storedOwnFood()).toMatchObject({ name: 'Protein shake', phe: 12 })
  })

  it('matches a duplicate whose legacy Phe value is stored as a string', async () => {
    seedTwo()
    const ownFood = (fake.data['owner-1'] as { ownFood: Record<string, Record<string, unknown>> })
      .ownFood
    ownFood.entry2!.phe = '30'

    await expect(updateOwnFood(request({ name: 'breakfast BAR', phe: 30 }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'duplicate-own-food' }
    })
  })

  // A different Phe value is a different food under the same rule, so the same
  // name on its own must not block an edit.
  it('allows the same name with a different phe value', async () => {
    seedTwo()

    await updateOwnFood(request({ name: 'Breakfast bar', phe: 31 }))

    expect(storedOwnFood()).toMatchObject({ name: 'Breakfast bar', phe: 31 })
  })

  // The entry being edited is not its own duplicate — saving an unchanged form
  // is the most ordinary thing a user does here.
  it('lets an entry keep its own name and phe', async () => {
    seedTwo()

    await updateOwnFood(request({ note: 'Mixed with water' }))

    expect(storedOwnFood()).toMatchObject({
      name: 'Protein shake',
      phe: 12,
      note: 'Mixed with water'
    })
  })
})

// Two own foods can already collide: the check above didn't exist until now, so
// a user can have edited one into the other long ago. Re-checking the whole
// record on every update would trap both entries — every save would fail on a
// name the user isn't editing. Only what the rule looks at is checked.
describe('editing a food that already collides with another', () => {
  const seedColliding = (entry1: Record<string, unknown>) => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: {
          entry1,
          entry2: { name: 'Protein shake', phe: 12, kcal: 90, shared: false }
        }
      },
      communityFoods: {
        community1: {
          name: 'Protein shake',
          phe: 12,
          contributorId: 'owner-1',
          ownFoodKey: 'entry1'
        }
      }
    })
  }

  // The case that has nothing to do with duplicates at all.
  it('lets the food be unshared', async () => {
    seedColliding({ ...OWN_FOOD, shared: true, communityKey: 'community1' })

    const result = await updateOwnFood(request({ shared: false }))

    expect(result.communityKey).toBeNull()
    expect(fake.data.communityFoods).toBeUndefined()
    expect(storedOwnFood().shared).toBe(false)
  })

  it('does not treat an unchanged legacy string Phe as an identity edit', async () => {
    seedColliding({ ...OWN_FOOD, phe: '12' })

    await updateOwnFood(request({ note: 'Mixed with water' }))

    expect(storedOwnFood()).toMatchObject({ phe: 12, note: 'Mixed with water' })
  })

  // The way out of the collision has to stay open.
  it('lets the food be renamed out of the collision', async () => {
    seedColliding({ ...OWN_FOOD })

    await updateOwnFood(request({ name: 'Protein shake XL' }))

    expect(storedOwnFood().name).toBe('Protein shake XL')
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

    expect(fake.data.communityFoods).toBeUndefined()
    expect(result.communityKey).toBeNull()
    // Firebase deletes a child written as null, so the field is gone from the
    // record rather than present and null — what the client's listener sees.
    expect(storedOwnFood()).not.toHaveProperty('communityKey')
  })

  it('removes comments and history with the community entry', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: {
          name: 'Protein shake',
          phe: 12,
          contributorId: 'owner-1',
          commentCount: 1
        }
      }
    )
    fake.data.communityFoodComments = {
      community1: {
        comment1: {
          authorId: 'commenter-1',
          text: 'Check the serving size',
          createdAt: 100,
          updatedAt: 100
        }
      }
    }
    communityComments().community1!.history = {
      type: 'content-update',
      createdAt: 200,
      changedFields: ['phe']
    }
    await updateOwnFood(request({ shared: false }))

    expect(fake.data.communityFoodComments).toBeUndefined()
  })

  it("does not delete another contributor's food through a malformed pointer", async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: {
          name: "Someone else's food",
          phe: 25,
          contributorId: 'owner-2',
          ownFoodKey: 'entry-other'
        }
      }
    )

    await updateOwnFood(request({ shared: false }))

    expect(community().community1).toMatchObject({ contributorId: 'owner-2' })
    expect(storedOwnFood().shared).toBe(false)
    expect(storedOwnFood()).not.toHaveProperty('communityKey')
  })

  it('trusts a verified pointer over a drifted shared flag when unsharing', async () => {
    seed(
      { ...OWN_FOOD, shared: false, communityKey: 'community1' },
      { community1: { name: 'Protein shake', phe: 12 } }
    )

    await updateOwnFood(request({ shared: false }))

    expect(fake.data.communityFoods).toBeUndefined()
    expect(storedOwnFood()).not.toHaveProperty('communityKey')
  })
})

describe('repairing an invalid community link', () => {
  it('does not use a malformed non-string pointer as a database path', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: { malformed: true } },
      {
        '[object Object]': {
          name: 'Unrelated food',
          phe: 25,
          contributorId: 'owner-1',
          ownFoodKey: 'entry1'
        }
      }
    )

    const result = await updateOwnFood(request({ shared: true }))

    expect(result.communityKey).not.toBe('[object Object]')
    expect(community()['[object Object]']).toMatchObject({ name: 'Unrelated food', phe: 25 })
    expect(community()[result.communityKey!]).toMatchObject({
      name: 'Protein shake',
      contributorId: 'owner-1',
      ownFoodKey: 'entry1'
    })
  })

  it('recreates a missing public copy and updates the pointer atomically', async () => {
    seed({ ...OWN_FOOD, shared: true, communityKey: 'missing' })

    const result = await updateOwnFood(request({ shared: true }))

    expect(result.communityKey).not.toBe('missing')
    expect(community()[result.communityKey!]).toMatchObject({
      name: 'Protein shake',
      contributorId: 'owner-1',
      ownFoodKey: 'entry1'
    })
    expect(storedOwnFood().communityKey).toBe(result.communityKey)
  })

  it("replaces a foreign pointer without touching the other contributor's food", async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'foreign' },
      {
        foreign: {
          name: 'Different food',
          phe: 25,
          contributorId: 'owner-2',
          ownFoodKey: 'entry-other'
        }
      }
    )

    const result = await updateOwnFood(request({ shared: true }))

    expect(community().foreign).toMatchObject({ contributorId: 'owner-2' })
    expect(result.communityKey).not.toBe('foreign')
    expect(community()[result.communityKey!]).toMatchObject({
      contributorId: 'owner-1',
      ownFoodKey: 'entry1'
    })
  })

  it('leaves the broken state untouched when its atomic repair write fails', async () => {
    const failWrite: WriteFailure = (operation) => operation === 'update'
    seed({ ...OWN_FOOD, shared: true, communityKey: 'missing' }, {}, failWrite)

    await expect(updateOwnFood(request({ shared: true }))).rejects.toMatchObject({
      statusCode: 500
    })

    expect(Object.keys(community())).toHaveLength(0)
    expect(storedOwnFood()).toMatchObject({ shared: true, communityKey: 'missing' })
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
          createdAt: 50,
          updatedAt: 50,
          contentUpdatedAt: 50,
          voterIds: { 'voter-1': 1 }
        }
      }
    )

  const seedComment = () => {
    community().community1!.commentCount = 1
    fake.data.communityFoodComments = {
      community1: {
        comment1: {
          authorId: 'commenter-1',
          text: 'Check the serving size',
          createdAt: 100,
          updatedAt: 100
        }
      }
    }
  }

  // Votes endorse a specific set of numbers. Once those change the endorsement
  // no longer applies, so the score has to start over.
  it('resets votes but keeps feedback and appends history when Phe changes', async () => {
    seedShared()
    seedComment()
    let clock = 200
    vi.spyOn(Date, 'now').mockImplementation(() => clock++)

    await updateOwnFood(request({ shared: true, phe: 20 }))

    expect(community().community1).toMatchObject({
      phe: 20,
      likes: 0,
      dislikes: 0,
      score: 0,
      commentCount: 1
    })
    expect(community().community1!.voterIds).toBeUndefined()
    expect(communityComments().community1).toHaveProperty('comment1')
    expect(Object.values(communityComments().community1!)).toContainEqual({
      type: 'content-update',
      changedFields: ['phe'],
      createdAt: community().community1!.contentUpdatedAt
    })
    expect(community().community1!.createdAt).toBe(50)
    expect(community().community1!.contentUpdatedAt).toBeGreaterThan(50)
    expect(storedOwnFood().updatedAt).toBe(community().community1!.contentUpdatedAt)
  })

  it('resets the votes when the name or kcal changes', async () => {
    seedShared()
    await updateOwnFood(request({ shared: true, name: 'Protein shake XL' }))
    expect(community().community1).toMatchObject({
      name: 'Protein shake XL',
      score: 0,
      materiallyEdited: true
    })

    seedShared()
    await updateOwnFood(request({ shared: true, kcal: 120 }))
    expect(community().community1).toMatchObject({
      kcal: 120,
      score: 0,
      materiallyEdited: true
    })
  })

  it('resets votes when nutrients change', async () => {
    seed(
      {
        ...OWN_FOOD,
        nutrients: { protein: 5 },
        shared: true,
        communityKey: 'community1'
      },
      {
        community1: {
          name: 'Protein shake',
          phe: 12,
          kcal: 90,
          nutrients: { protein: 5 },
          likes: 5,
          dislikes: 1,
          score: 4,
          voterIds: { 'voter-1': 1 }
        }
      }
    )

    await updateOwnFood(request({ shared: true, nutrients: { protein: 6 } }))

    expect(community().community1).toMatchObject({
      nutrients: { protein: 6 },
      likes: 0,
      dislikes: 0,
      score: 0,
      materiallyEdited: true
    })
    expect(community().community1!.voterIds).toBeUndefined()
  })

  it('keeps votes for a capitalization-only name edit', async () => {
    seedShared()

    await updateOwnFood(request({ shared: true, name: 'PROTEIN SHAKE' }))

    expect(community().community1).toMatchObject({
      name: 'PROTEIN SHAKE',
      likes: 5,
      dislikes: 1,
      score: 4
    })
    expect(community().community1).not.toHaveProperty('materiallyEdited')
  })

  // An edit that leaves the numbers alone must not wipe hard-earned votes.
  it('keeps the votes when only the note changes', async () => {
    seedShared()
    seedComment()

    await updateOwnFood(request({ shared: true, note: 'Mixed with water' }))

    expect(community().community1).toMatchObject({
      note: 'Mixed with water',
      likes: 5,
      dislikes: 1,
      score: 4,
      commentCount: 1
    })
    expect(community().community1!.voterIds).toEqual({ 'voter-1': 1 })
    expect(communityComments().community1).toHaveProperty('comment1')
    expect(storedOwnFood()).not.toHaveProperty('materiallyEdited')
    expect(Object.values(communityComments().community1!)).toContainEqual({
      type: 'content-update',
      changedFields: ['note'],
      createdAt: community().community1!.contentUpdatedAt
    })
  })

  it('records each successive note edit, including removal, without losing earlier history', async () => {
    seedShared()
    seedComment()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(200)
    await updateOwnFood(request({ shared: true, note: 'With water' }))
    clock.mockReturnValue(300)
    await updateOwnFood(request({ shared: true, note: 'With milk' }))
    clock.mockReturnValue(400)
    await updateOwnFood(request({ shared: true, note: null }))

    expect(Object.values(communityComments().community1!)).toEqual([
      expect.objectContaining({ text: 'Check the serving size', createdAt: 100 }),
      {
        type: 'content-update',
        createdAt: 200,
        changedFields: ['note']
      },
      {
        type: 'content-update',
        createdAt: 300,
        changedFields: ['note']
      },
      {
        type: 'content-update',
        createdAt: 400,
        changedFields: ['note']
      }
    ])
    expect(community().community1).toMatchObject({
      commentCount: 1,
      likes: 5,
      dislikes: 1,
      createdAt: 50,
      contentUpdatedAt: 400
    })
    expect(storedOwnFood()).not.toHaveProperty('materiallyEdited')
  })

  it('records multiple changed fields in one system entry without counting it as a comment', async () => {
    seedShared()
    await updateOwnFood(
      request({ shared: true, name: 'New shake', phe: 20, note: 'Corrected label' })
    )

    expect(Object.values(communityComments().community1!)).toEqual([
      {
        type: 'content-update',
        createdAt: community().community1!.contentUpdatedAt,
        changedFields: ['name', 'phe', 'note']
      }
    ])
    expect(community().community1!.commentCount ?? 0).toBe(0)
  })

  it.each(['protein', 'fat', 'carbs', 'sugar', 'fiber', 'salt', 'factor', 'kcal'])(
    'records a %s correction and resets votes',
    async (field) => {
      seedShared()
      const change =
        field === 'factor' || field === 'kcal' ? { [field]: 2 } : { nutrients: { [field]: 2 } }
      await updateOwnFood(request({ shared: true, ...change }))

      expect(Object.values(communityComments().community1!)).toEqual([
        {
          type: 'content-update',
          createdAt: community().community1!.contentUpdatedAt,
          changedFields: [field]
        }
      ])
      expect(community().community1).toMatchObject({ likes: 0, dislikes: 0, score: 0 })
    }
  )

  it('does not bump content or append history for unchanged or cosmetic saves', async () => {
    seedShared()
    seedComment()
    vi.spyOn(Date, 'now').mockReturnValue(200)
    const threadBefore = structuredClone(communityComments())
    await updateOwnFood(request({ shared: true }))
    await updateOwnFood(request({ shared: true, emoji: '🥤', icon: 'shake' }))
    await updateOwnFood(request({ shared: true, name: ' Protein shake ', note: '  ' }))

    expect(community().community1).toMatchObject({
      createdAt: 50,
      contentUpdatedAt: 50,
      updatedAt: 200,
      likes: 5,
      commentCount: 1
    })
    expect(communityComments()).toEqual(threadBefore)
  })

  it('ignores equivalent legacy number formats and missing optional values', async () => {
    seedShared()
    Object.assign(community().community1!, {
      phe: '12.00',
      kcal: '90',
      factor: null,
      nutrients: {}
    })
    await updateOwnFood(request({ shared: true, nutrients: { protein: null }, factor: null }))
    expect(community().community1!.contentUpdatedAt).toBe(50)
    expect(fake.data.communityFoodComments).toBeUndefined()
  })

  it('does not trust a client-supplied content timestamp', async () => {
    seedShared()
    await updateOwnFood(request({ shared: true, contentUpdatedAt: 9999999999999 }))
    expect(community().community1!.contentUpdatedAt).toBe(50)
    expect(storedOwnFood()).not.toHaveProperty('contentUpdatedAt')
  })

  it('keeps votes when unchanged legacy values are stored as strings', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: {
          name: 'Protein shake',
          phe: '12',
          kcal: '90',
          likes: 5,
          dislikes: 1,
          score: 4,
          voterIds: { 'voter-1': 1 }
        }
      }
    )

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

// The own food and its published copy use one atomic multi-location update.
// These tests ensure a failed write cannot leave only one copy persisted.
describe('when the database write fails', () => {
  const failWrite: WriteFailure = (operation) => operation === 'update'

  it('surfaces the failure as a 500 rather than reporting success', async () => {
    seed({ ...OWN_FOOD }, {}, failWrite)

    await expect(updateOwnFood(request({ shared: true }))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Internal server error'
    })
  })

  it('leaves the own food untouched', async () => {
    seed({ ...OWN_FOOD }, {}, failWrite)

    await updateOwnFood(request({ shared: true, name: 'Renamed' })).catch(() => {})

    expect(storedOwnFood()).toMatchObject({ name: 'Protein shake', shared: false })
    expect(storedOwnFood()).not.toHaveProperty('communityKey')
  })

  // Sharing is atomic: a failed write must not leave a public-only record.
  it('publishes nothing when the write fails', async () => {
    seed({ ...OWN_FOOD }, {}, failWrite)

    await updateOwnFood(request({ shared: true })).catch(() => {})

    expect(Object.keys(community())).toHaveLength(0)
  })

  it('keeps both records when unsharing fails', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      { community1: { name: 'Protein shake', phe: 12, contributorId: 'owner-1' } },
      failWrite
    )

    await expect(updateOwnFood(request({ shared: false }))).rejects.toMatchObject({
      statusCode: 500
    })
    // The own food must still say shared, matching the entry that is still live.
    expect(community().community1).toBeDefined()
    expect(storedOwnFood().shared).toBe(true)
  })

  // A rejected edit of a published food leaves the votes and the values it had.
  it('keeps the published copy as it was when an edit fails', async () => {
    seed(
      { ...OWN_FOOD, shared: true, communityKey: 'community1' },
      {
        community1: { name: 'Protein shake', phe: 12, kcal: 90, likes: 5, score: 5 }
      },
      failWrite
    )

    await updateOwnFood(request({ shared: true, phe: 20 })).catch(() => {})

    expect(community().community1).toMatchObject({ phe: 12, likes: 5, score: 5 })
    expect(storedOwnFood().phe).toBe(12)
    expect(community().community1).not.toHaveProperty('contentUpdatedAt')
    expect(fake.data.communityFoodComments).toBeUndefined()
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
