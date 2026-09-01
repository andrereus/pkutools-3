import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'user-1' }))

const updateFoodItem = (await import('../server/api/diary/food-items/[key].put'))
  .default as unknown as (event: unknown) => Promise<{ key: string }>
const updateDay = (await import('../server/api/diary/days/[key].put')).default as unknown as (
  event: unknown
) => Promise<{ key: string }>

const ORIGINAL = {
  name: 'Oat drink',
  pheReference: 50,
  kcalReference: 45,
  weight: 100,
  phe: 50,
  kcal: 45,
  nutrients: { protein: 1, fat: 1.5 },
  source: 'barcode',
  sourceId: '4009233001234',
  factor: 50,
  addedFrom: 'own-food',
  communityFoodKey: 'community1',
  createdAt: 1000,
  updatedAt: 1000
}

const withoutConversion = () => {
  const { factor: _factor, nutrients: _nutrients, ...entry } = ORIGINAL
  return entry
}

const seed = (item: Record<string, unknown> = ORIGINAL) => {
  fake = createFakeDatabase({
    'user-1': {
      pheDiary: {
        day1: { date: '2026-08-04', phe: item.phe, kcal: item.kcal, log: [item] }
      }
    }
  })
}

const stored = () =>
  (
    fake.data['user-1'] as {
      pheDiary: { day1: { log: Array<Record<string, unknown>> } }
    }
  ).pheDiary.day1.log[0]!

const storedLog = () =>
  (
    fake.data['user-1'] as {
      pheDiary: { day1: { log: Array<Record<string, unknown>> } }
    }
  ).pheDiary.day1.log

const putItem = (entry: Record<string, unknown>) =>
  updateFoodItem(
    requestEvent({ logIndex: 0, entry: { ...ORIGINAL, ...entry } }, {}, { key: 'day1' })
  )

beforeEach(() => seed())

describe('diary item provenance after edits', () => {
  it('preserves where the item came from and marks a material edit', async () => {
    await putItem({
      name: 'Oat drink unsweetened',
      pheReference: 60,
      phe: 60,
      source: 'manual',
      sourceId: null,
      addedFrom: null,
      communityFoodKey: null
    })

    expect(stored()).toMatchObject({
      name: 'Oat drink unsweetened',
      pheReference: 60,
      source: 'barcode',
      sourceId: '4009233001234',
      factor: 50,
      addedFrom: 'own-food',
      communityFoodKey: 'community1',
      materiallyEdited: true,
      createdAt: 1000
    })
  })

  it('takes a corrected factor with the reference it produced', async () => {
    await putItem({
      pheReference: 27,
      phe: 27,
      factor: 27,
      nutrients: { protein: 1 }
    })

    expect(stored()).toMatchObject({
      pheReference: 27,
      factor: 27,
      source: 'barcode',
      sourceId: '4009233001234',
      materiallyEdited: true
    })
  })

  it('keeps conversion fields omitted by a single-item update', async () => {
    await updateFoodItem(
      requestEvent(
        { logIndex: 0, entry: { ...withoutConversion(), note: 'Updated note' } },
        {},
        { key: 'day1' }
      )
    )

    expect(stored()).toMatchObject({
      note: 'Updated note',
      nutrients: ORIGINAL.nutrients,
      factor: ORIGINAL.factor
    })
    expect(stored()).not.toHaveProperty('materiallyEdited')
  })

  it('allows conversion fields to be cleared explicitly', async () => {
    await putItem({ factor: null, nutrients: null })

    expect(stored()).toMatchObject({ factor: null, nutrients: null, materiallyEdited: true })
  })

  it('does not count serving-size, note, or presentation edits as material', async () => {
    await putItem({ weight: 200, phe: 100, kcal: 90, note: 'Breakfast', emoji: '🥛' })

    expect(stored()).toMatchObject({ weight: 200, note: 'Breakfast', source: 'barcode' })
    expect(stored()).not.toHaveProperty('materiallyEdited')
  })

  it('does not allow a previously set flag to be reset', async () => {
    seed({ ...ORIGINAL, materiallyEdited: true })

    await putItem({ materiallyEdited: false, note: 'Updated note' })

    expect(stored().materiallyEdited).toBe(true)
  })

  it('preserves a stable item id against an edited request', async () => {
    seed({ ...ORIGINAL, itemId: '-Noriginal' })

    await putItem({ itemId: '-Nreplacement', note: 'Updated note' })

    expect(stored().itemId).toBe('-Noriginal')
  })

  it('does not let an edit invent a creation time for a legacy item', async () => {
    const { createdAt: _createdAt, ...legacyItem } = ORIGINAL
    seed(legacyItem)

    await putItem({ createdAt: 9999, note: 'Updated note' })

    expect(stored()).not.toHaveProperty('createdAt')
  })

  it('derives the same flag when Diet Report saves a complete log', async () => {
    await updateDay(
      requestEvent(
        {
          date: '2026-08-04',
          phe: 50,
          kcal: 45,
          log: [{ ...ORIGINAL, nutrients: { protein: 2, fat: 1.5 } }]
        },
        {},
        { key: 'day1' }
      )
    )

    expect(stored()).toMatchObject({
      nutrients: { protein: 2, fat: 1.5 },
      source: 'barcode',
      sourceId: '4009233001234',
      materiallyEdited: true
    })
  })

  it('keeps conversion fields omitted by a complete-log update', async () => {
    await updateDay(
      requestEvent(
        {
          date: '2026-08-04',
          phe: 50,
          kcal: 45,
          log: [{ ...withoutConversion(), note: 'Updated in Diet Report' }]
        },
        {},
        { key: 'day1' }
      )
    )

    expect(stored()).toMatchObject({
      note: 'Updated in Diet Report',
      nutrients: ORIGINAL.nutrients,
      factor: ORIGINAL.factor
    })
    expect(stored()).not.toHaveProperty('materiallyEdited')
  })

  it('upgrades the oldest identity-less item without losing its provenance', async () => {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...oldestItem } = ORIGINAL
    seed(oldestItem)

    await updateDay(
      requestEvent(
        {
          date: '2026-08-04',
          phe: 50,
          kcal: 45,
          log: [{ ...oldestItem, note: 'Still the same food' }]
        },
        {},
        { key: 'day1' }
      )
    )

    expect(stored()).toMatchObject({
      note: 'Still the same food',
      source: 'barcode',
      sourceId: '4009233001234',
      addedFrom: 'own-food'
    })
    expect(stored().itemId).toBeTruthy()
    expect(stored()).not.toHaveProperty('createdAt')
  })

  it('keeps provenance separate when legacy timestamps collide', async () => {
    const second = {
      ...ORIGINAL,
      name: 'AI meal',
      source: 'ai-estimate',
      sourceId: null,
      factor: null,
      addedFrom: null,
      communityFoodKey: null,
      createdAt: 1000
    }
    fake = createFakeDatabase({
      'user-1': {
        pheDiary: {
          day1: {
            date: '2026-08-04',
            phe: 100,
            kcal: 90,
            log: [ORIGINAL, second]
          }
        }
      }
    })

    await updateDay(
      requestEvent(
        {
          date: '2026-08-04',
          phe: 100,
          kcal: 90,
          log: [
            { ...ORIGINAL, note: 'First' },
            { ...second, note: 'Second' }
          ]
        },
        {},
        { key: 'day1' }
      )
    )

    expect(storedLog()[0]).toMatchObject({ source: 'barcode', note: 'First' })
    expect(storedLog()[1]).toMatchObject({ source: 'ai-estimate', note: 'Second' })
    const ids = storedLog().map((item) => item.itemId)
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])

    const [first, secondStored] = structuredClone(storedLog())
    await updateDay(
      requestEvent(
        {
          date: '2026-08-04',
          phe: 100,
          kcal: 90,
          log: [
            { ...secondStored, note: 'Moved first' },
            { ...first, note: 'Moved second' }
          ]
        },
        {},
        { key: 'day1' }
      )
    )

    expect(storedLog()[0]).toMatchObject({ itemId: ids[1], source: 'ai-estimate' })
    expect(storedLog()[1]).toMatchObject({ itemId: ids[0], source: 'barcode' })
  })

  it('does not give a new item the deleted item identity when the length stays equal', async () => {
    const first = { ...ORIGINAL, itemId: '-Nfirst' }
    const deleted = {
      ...ORIGINAL,
      itemId: '-Ndeleted',
      name: 'AI meal',
      source: 'ai-estimate',
      sourceId: null,
      factor: null,
      addedFrom: null,
      communityFoodKey: null,
      createdAt: 2000
    }
    fake = createFakeDatabase({
      'user-1': {
        pheDiary: {
          day1: {
            date: '2026-08-04',
            phe: 100,
            kcal: 90,
            log: [first, deleted]
          }
        }
      }
    })

    await updateDay(
      requestEvent(
        {
          date: '2026-08-04',
          phe: 75,
          kcal: 70,
          log: [
            first,
            {
              name: 'New manual food',
              weight: 100,
              phe: 25,
              kcal: 25,
              source: 'manual',
              createdAt: 3000,
              updatedAt: 3000
            }
          ]
        },
        {},
        { key: 'day1' }
      )
    )

    expect(storedLog()[0]).toMatchObject({ itemId: '-Nfirst', source: 'barcode' })
    expect(storedLog()[1]).toMatchObject({
      name: 'New manual food',
      source: 'manual',
      createdAt: 3000
    })
    expect(storedLog()[1]!.itemId).toBeTruthy()
    expect(storedLog()[1]!.itemId).not.toBe('-Ndeleted')
    expect(storedLog()[1]).not.toHaveProperty('addedFrom')
    expect(storedLog()[1]).not.toHaveProperty('communityFoodKey')
  })

  it('rejects a stale submitted item id instead of matching by weaker metadata', async () => {
    seed({ ...ORIGINAL, itemId: '-Nstored' })

    await expect(
      updateDay(
        requestEvent(
          {
            date: '2026-08-04',
            phe: 50,
            kcal: 45,
            log: [{ ...ORIGINAL, itemId: '-Nstale' }]
          },
          {},
          { key: 'day1' }
        )
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'stale-diary-log' }
    })

    expect(stored()).toMatchObject({ itemId: '-Nstored', source: 'barcode' })
  })

  it('rejects duplicate submitted ids instead of guessing which item they identify', async () => {
    const first = { ...ORIGINAL, itemId: '-Nsame' }
    const second = { ...ORIGINAL, itemId: '-Nsecond', name: 'Second', createdAt: 2000 }
    fake = createFakeDatabase({
      'user-1': {
        pheDiary: {
          day1: { date: '2026-08-04', phe: 100, kcal: 90, log: [first, second] }
        }
      }
    })

    await expect(
      updateDay(
        requestEvent(
          {
            date: '2026-08-04',
            phe: 100,
            kcal: 90,
            log: [first, { ...second, itemId: '-Nsame' }]
          },
          {},
          { key: 'day1' }
        )
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'duplicate-diary-item-id' }
    })

    expect(storedLog()).toEqual([first, second])
  })
})
