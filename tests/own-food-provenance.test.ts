import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

// The calculators and scanners can now save what they computed as an own food,
// and publish it. What travels with those values decides two things later: what
// food search can tell everyone about a community food's origin, and whether
// the food may be published at all.

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'owner-1' }))
vi.mock(import('../server/utils/license'), async (importOriginal) => ({
  ...(await importOriginal()),
  checkPremiumStatus: async () => true
}))

const saveOwnFood = (await import('../server/api/own-food/save.post')).default as unknown as (
  event: unknown
) => Promise<{ key: string; communityKey?: string | null }>
const updateOwnFood = (await import('../server/api/own-food/update.post')).default as unknown as (
  event: unknown
) => Promise<{ key: string; communityKey: string | null }>

// A product scanned in the barcode scanner: Phe converted from the declared
// protein, with the barcode and the nutrients the label reports.
const SCANNED = {
  name: 'Oat drink',
  phe: 50,
  kcal: 45,
  note: null,
  locale: 'en',
  source: 'barcode',
  sourceId: '4009233001234',
  factor: 50,
  nutrients: { protein: 1, fat: 1.5, salt: 0.09 }
}

const community = () => (fake.data.communityFoods ?? {}) as Record<string, Record<string, unknown>>
const ownFoods = () =>
  (fake.data['owner-1'] as { ownFood: Record<string, Record<string, unknown>> } | undefined)
    ?.ownFood ?? {}
const firstOwnFood = () => Object.values(ownFoods())[0]!

beforeEach(() => {
  fake = createFakeDatabase()
})

describe('saving a calculated food as an own food', () => {
  it('keeps the provenance the tool computed it from', async () => {
    await saveOwnFood(requestEvent({ ...SCANNED, shared: false }))

    expect(firstOwnFood()).toMatchObject({
      phe: 50,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50
    })
    expect(firstOwnFood().nutrients).toEqual({ protein: 1, fat: 1.5, salt: 0.09 })
  })

  // Without this the published copy is a bare name and a number, and nobody can
  // tell whether it was read off a label or guessed.
  it('publishes the provenance along with the values', async () => {
    await saveOwnFood(requestEvent({ ...SCANNED, shared: true }))

    const published = Object.values(community())[0]!
    expect(published).toMatchObject({
      name: 'Oat drink',
      phe: 50,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50,
      language: 'en',
      contributorId: 'owner-1',
      commentCount: 0
    })
    expect(published.nutrients).toEqual({ protein: 1, fat: 1.5, salt: 0.09 })
  })

  // Nothing forces a tool to send provenance, and the own-food form doesn't.
  it('publishes a food that has no provenance', async () => {
    await saveOwnFood(
      requestEvent({ name: 'Shake', phe: 12, kcal: 90, shared: true, locale: 'en' })
    )

    const published = Object.values(community())[0]!
    expect(published).toMatchObject({ name: 'Shake', phe: 12, contributorId: 'owner-1' })
    // Firebase drops a child written as null, so an absent origin is absent
    // rather than stored as null.
    expect(published.source ?? null).toBeNull()
  })
})

// Scanning a product a second time is how a user checks what they are eating,
// not a request for a second copy of the food.
describe('saving the same product twice', () => {
  it('reports the food it already has instead of refusing the save', async () => {
    await saveOwnFood(requestEvent({ ...SCANNED, shared: false }))
    const [firstKey] = Object.keys(ownFoods())

    const second = await saveOwnFood(requestEvent({ ...SCANNED, shared: false }))

    expect(second).toMatchObject({ success: true, key: firstKey, alreadyExists: true })
    expect(Object.keys(ownFoods())).toHaveLength(1)
  })

  // Open Food Facts is user-edited, so the same barcode can come back with a
  // different protein value. It is still the same product, and the entry the
  // user already has is not overwritten behind their back.
  it('recognises the product even when the values moved', async () => {
    await saveOwnFood(requestEvent({ ...SCANNED, shared: false }))

    const second = await saveOwnFood(
      requestEvent({ ...SCANNED, phe: 65, name: 'Oat drink (new recipe)', shared: false })
    )

    expect(second.alreadyExists).toBe(true)
    expect(firstOwnFood()).toMatchObject({ name: 'Oat drink', phe: 50 })
  })

  it('keeps a different product apart', async () => {
    await saveOwnFood(requestEvent({ ...SCANNED, shared: false }))

    await saveOwnFood(
      requestEvent({ ...SCANNED, name: 'Soy drink', sourceId: '4009233009999', shared: false })
    )

    expect(Object.keys(ownFoods())).toHaveLength(2)
  })

  // Without a source id there is nothing to recognise the food by, so the
  // name + Phe rule still decides.
  it('still refuses a duplicate that carries no source id', async () => {
    await saveOwnFood(requestEvent({ name: 'Shake', phe: 12, kcal: 90, locale: 'en' }))

    await expect(
      saveOwnFood(requestEvent({ name: 'shake', phe: 12, kcal: 90, locale: 'en' }))
    ).rejects.toMatchObject({ statusCode: 409, data: { code: 'duplicate-own-food' } })
  })

  it('matches a duplicate whose legacy Phe value is stored as a string', async () => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: { legacy: { name: 'Shake', phe: '12', kcal: '90', shared: false } }
      }
    })

    await expect(
      saveOwnFood(requestEvent({ name: 'shake', phe: 12, kcal: 90, locale: 'en' }))
    ).rejects.toMatchObject({ statusCode: 409, data: { code: 'duplicate-own-food' } })
  })

  it('matches a published duplicate whose legacy Phe value is stored as a string', async () => {
    fake = createFakeDatabase({
      communityFoods: {
        legacy: {
          name: 'Shake',
          phe: '12',
          kcal: '90',
          language: 'en',
          likes: 0,
          dislikes: 0
        }
      }
    })

    await expect(
      saveOwnFood(requestEvent({ name: 'shake', phe: 12, kcal: 90, shared: true, locale: 'en' }))
    ).rejects.toMatchObject({ statusCode: 409, data: { code: 'duplicate-community-food' } })
    expect(Object.keys(ownFoods())).toHaveLength(0)
  })

  it('does not let a nameless legacy own food block every subsequent save', async () => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: { legacy: { phe: 5, kcal: 20, shared: false } }
      }
    })

    await saveOwnFood(requestEvent({ name: 'Shake', phe: 12, kcal: 90, locale: 'en' }))

    expect(Object.keys(ownFoods())).toHaveLength(2)
    expect(Object.values(ownFoods())).toContainEqual(
      expect.objectContaining({ name: 'Shake', phe: 12 })
    )
  })

  it('does not let a nameless legacy community food block sharing', async () => {
    fake = createFakeDatabase({
      communityFoods: {
        legacy: { phe: 5, kcal: 20, language: 'en', likes: 0, dislikes: 0 }
      }
    })

    await saveOwnFood(
      requestEvent({ name: 'Shake', phe: 12, kcal: 90, shared: true, locale: 'en' })
    )

    expect(Object.keys(community())).toHaveLength(2)
    expect(Object.values(community())).toContainEqual(
      expect.objectContaining({ name: 'Shake', phe: 12 })
    )
  })
})

describe('publishing a food the community should not get', () => {
  const ESTIMATE = {
    name: 'Pasta with sauce',
    phe: 320,
    kcal: 180,
    locale: 'en',
    source: 'ai-estimate'
  }

  // The AI calculator never offers the option for an estimate; this is what
  // happens when a request arrives claiming otherwise.
  it('refuses to save it as shared, and writes nothing at all', async () => {
    await expect(saveOwnFood(requestEvent({ ...ESTIMATE, shared: true }))).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'source-not-shareable' }
    })
    expect(Object.keys(community())).toHaveLength(0)
    // The own food is written in the same request, so a rejected share must not
    // leave the food behind either.
    expect(Object.keys(ownFoods())).toHaveLength(0)
  })

  it('saves the same food unshared', async () => {
    await saveOwnFood(requestEvent({ ...ESTIMATE, shared: false }))

    expect(firstOwnFood()).toMatchObject({ source: 'ai-estimate', communityKey: null })
  })

  it('refuses to publish it from the own-food form later', async () => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: {
          entry1: { name: 'Pasta with sauce', phe: 320, kcal: 180, source: 'ai-estimate' }
        }
      }
    })

    // The form sends no source of its own — the stored one still decides.
    await expect(
      updateOwnFood(
        requestEvent({
          entryKey: 'entry1',
          locale: 'en',
          data: { name: 'Pasta with sauce', phe: 320, kcal: 180, shared: true }
        })
      )
    ).rejects.toMatchObject({ statusCode: 400, data: { code: 'source-not-shareable' } })
    expect(Object.keys(community())).toHaveLength(0)
  })

  it('remains unshareable after its values are manually edited', async () => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: {
          entry1: { name: 'Pasta with sauce', phe: 320, kcal: 180, source: 'ai-estimate' }
        }
      }
    })

    await updateOwnFood(
      requestEvent({
        entryKey: 'entry1',
        locale: 'en',
        data: { name: 'Pasta with sauce', phe: 300, kcal: 180, shared: false }
      })
    )
    expect(storedOwnFood()).toMatchObject({
      source: 'ai-estimate',
      materiallyEdited: true
    })

    await expect(
      updateOwnFood(
        requestEvent({
          entryKey: 'entry1',
          locale: 'en',
          data: {
            name: 'Pasta with sauce',
            phe: 300,
            kcal: 180,
            shared: true,
            // Update validation strips attempts to rewrite original provenance.
            source: 'manual'
          }
        })
      )
    ).rejects.toMatchObject({ statusCode: 400, data: { code: 'source-not-shareable' } })
  })
})

describe('editing a published food', () => {
  const seedShared = (ownFood: Record<string, unknown>) => {
    fake = createFakeDatabase({
      'owner-1': {
        ownFood: {
          entry1: { ...ownFood, shared: true, communityKey: 'community1' }
        }
      },
      communityFoods: {
        community1: {
          name: 'Oat drink',
          phe: 50,
          kcal: 45,
          contributorId: 'owner-1',
          ownFoodKey: 'entry1',
          source: 'barcode',
          sourceId: '4009233001234',
          factor: 50,
          likes: 3,
          dislikes: 0,
          score: 3
        }
      }
    })
  }

  const editRequest = (data: Record<string, unknown>) =>
    requestEvent({
      entryKey: 'entry1',
      locale: 'en',
      data: { name: 'Oat drink', phe: 50, kcal: 45, shared: true, ...data }
    })

  // The form carries no provenance, and the stored record keeps it because
  // update() merges — the published copy must not lose it either.
  it('keeps the published provenance when only the note changes', async () => {
    seedShared({
      name: 'Oat drink',
      phe: 50,
      kcal: 45,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50
    })

    await updateOwnFood(editRequest({ note: 'Unsweetened' }))

    expect(community().community1).toMatchObject({
      note: 'Unsweetened',
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50,
      likes: 3
    })
  })

  it('preserves where the food came from and marks a material edit', async () => {
    seedShared({
      name: 'Oat drink',
      phe: 50,
      kcal: 45,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50
    })

    await updateOwnFood(editRequest({ phe: 62, source: 'manual', sourceId: null }))

    expect(community().community1).toMatchObject({
      phe: 62,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50,
      materiallyEdited: true
    })
    expect(storedOwnFood()).toMatchObject({
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50,
      materiallyEdited: true
    })
  })

  it('takes a corrected factor through to the published copy', async () => {
    seedShared({
      name: 'Apple',
      phe: 100,
      kcal: 52,
      source: 'manual',
      sourceId: null,
      factor: 50,
      nutrients: { protein: 2 }
    })

    await updateOwnFood(editRequest({ phe: 54, factor: 27, nutrients: { protein: 2 } }))

    expect(community().community1).toMatchObject({
      phe: 54,
      factor: 27,
      source: 'manual',
      materiallyEdited: true
    })
    expect(storedOwnFood()).toMatchObject({ phe: 54, factor: 27 })
  })

  it('resets the votes when only the conversion is corrected', async () => {
    seedShared({
      name: 'Apple',
      phe: 54,
      kcal: 52,
      source: 'manual',
      sourceId: null,
      factor: 50,
      nutrients: { protein: 2 }
    })

    await updateOwnFood(editRequest({ phe: 54, factor: 27, nutrients: { protein: 2 } }))

    expect(community().community1).toMatchObject({
      phe: 54,
      factor: 27,
      materiallyEdited: true,
      likes: 0,
      dislikes: 0,
      score: 0
    })
  })

  it('keeps the stored factor when the form sends none', async () => {
    seedShared({
      name: 'Oat drink',
      phe: 50,
      kcal: 45,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50
    })

    await updateOwnFood(editRequest({ note: 'Unsweetened' }))

    expect(storedOwnFood()).toMatchObject({ factor: 50 })
    expect(community().community1).toMatchObject({ factor: 50 })
  })
})

const storedOwnFood = () =>
  (fake.data['owner-1'] as { ownFood: Record<string, Record<string, unknown>> }).ownFood.entry1!
