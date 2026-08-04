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

const putItem = (entry: Record<string, unknown>) =>
  updateFoodItem(
    requestEvent({ logIndex: 0, entry: { ...ORIGINAL, ...entry } }, {}, { key: 'day1' })
  )

beforeEach(() => seed())

describe('diary item provenance after edits', () => {
  it('preserves original provenance and marks a material edit', async () => {
    await putItem({
      name: 'Oat drink unsweetened',
      pheReference: 60,
      phe: 60,
      source: 'manual',
      sourceId: null,
      factor: null,
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
})
