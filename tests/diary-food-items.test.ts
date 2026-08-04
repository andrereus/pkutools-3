import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

// Adding a food is the app's busiest write. It either starts a new diary day or
// appends to an existing one, and in both cases the day's Phe and kcal totals —
// the numbers the user checks against their daily limit — are recomputed here.

installServerGlobals()

let fake = createFakeDatabase()
let isPremium = false

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'user-1' }))
vi.mock(import('../server/utils/license'), () => ({ checkPremiumStatus: async () => isPremium }))

const addFoodItem = (await import('../server/api/diary/food-items.post')).default as unknown as (
  event: unknown
) => Promise<{ key: string; updated: boolean }>

const ENTRY = { name: 'Apple', weight: 150, phe: 27, kcal: 78 }

const seedDiary = (pheDiary: Record<string, unknown> = {}) => {
  fake = createFakeDatabase({ 'user-1': { pheDiary } })
}

const diary = () =>
  (fake.data['user-1'] as { pheDiary: Record<string, Record<string, unknown>> }).pheDiary

const day = (key: string) =>
  diary()[key] as unknown as { phe: number; kcal: number; log: { phe: number }[]; date: string }

beforeEach(() => {
  isPremium = false
  seedDiary()
})

describe('adding a food item to a new day', () => {
  it('creates the day with the item as its total', async () => {
    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    expect(result.updated).toBe(false)
    const created = day(result.key)
    expect(created).toMatchObject({ date: '2026-07-26', phe: 27, kcal: 78 })
    expect(created.log).toHaveLength(1)
  })

  it('stamps server timestamps on the entry and the day', async () => {
    const before = Date.now()
    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    const created = day(result.key) as unknown as {
      createdAt: number
      log: { createdAt: number }[]
    }
    expect(created.log[0]!.createdAt).toBeGreaterThanOrEqual(before)
    // The day inherits its first item's createdAt, so an undo-restore recovers
    // the original day creation time.
    expect(created.createdAt).toBe(created.log[0]!.createdAt)
  })

  it('assigns every item a stable server id', async () => {
    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))
    const created = day(result.key) as unknown as { log: Array<{ itemId: string }> }

    expect(created.log[0]!.itemId).toMatch(/^-Nfake/)
  })
})

describe('adding a food item to an existing day', () => {
  beforeEach(() => {
    seedDiary({
      day1: {
        date: '2026-07-26',
        phe: 100,
        kcal: 500,
        log: [{ name: 'Bread', weight: 50, phe: 100, kcal: 500 }]
      }
    })
  })

  it('appends the item and recomputes the day totals', async () => {
    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    expect(result).toMatchObject({ key: 'day1', updated: true })
    expect(day('day1')).toMatchObject({ phe: 127, kcal: 578 })
    expect(day('day1').log).toHaveLength(2)
  })

  it('does not accept a duplicate restored item id', async () => {
    seedDiary({
      day1: {
        date: '2026-07-26',
        phe: 100,
        kcal: 500,
        log: [{ ...ENTRY, itemId: '-Noriginal' }]
      }
    })

    await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26', itemId: '-Noriginal' }))

    const ids = (day('day1').log as unknown as Array<{ itemId: string }>).map((item) => item.itemId)
    expect(new Set(ids).size).toBe(2)
    expect(ids).toContain('-Noriginal')
  })

  // Totals are summed from the log rather than added to the stored total, so a
  // day whose stored total had drifted is corrected on the next write.
  it('recomputes totals from the log', async () => {
    seedDiary({
      day1: {
        date: '2026-07-26',
        phe: 9999,
        kcal: 9999,
        log: [{ name: 'Bread', weight: 50, phe: 100, kcal: 500 }]
      }
    })

    await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    expect(day('day1')).toMatchObject({ phe: 127, kcal: 578 })
  })

  it('normalizes legacy numeric strings when recomputing totals', async () => {
    seedDiary({
      day1: {
        date: '2026-07-26',
        phe: '100',
        kcal: '500',
        log: [{ name: 'Bread', weight: 50, phe: '100', kcal: '500' }]
      }
    })

    await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    expect(day('day1')).toMatchObject({ phe: 127, kcal: 578 })
    expect(typeof day('day1').phe).toBe('number')
    expect(typeof day('day1').kcal).toBe('number')
  })

  it('starts a separate day for a different date', async () => {
    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-27' }))

    expect(result.updated).toBe(false)
    expect(Object.keys(diary())).toHaveLength(2)
    expect(day('day1').phe).toBe(100)
  })
})

// The tools send where a value came from along with it. Zod strips anything the
// schema doesn't declare, so this is the guard that provenance actually reaches
// storage instead of being dropped somewhere between the form and Firebase.
describe('provenance on a stored item', () => {
  it('stores nutrients, factor, source and sourceId with the item', async () => {
    const result = await addFoodItem(
      requestEvent({
        ...ENTRY,
        date: '2026-07-26',
        pheReference: 105.8,
        nutrients: { protein: 2.3, fat: 0.4 },
        factor: 46,
        source: 'barcode',
        sourceId: '4006381333931'
      })
    )

    const stored = day(result.key).log[0] as unknown as Record<string, unknown>
    expect(stored).toMatchObject({
      pheReference: 105.8,
      nutrients: { protein: 2.3, fat: 0.4 },
      factor: 46,
      source: 'barcode',
      sourceId: '4006381333931'
    })
  })

  // The reference is stored unrounded so that recalculating the result from it
  // — which the diary does on every edit — reproduces the stored result. A
  // reference rounded to a whole mg would drift here.
  it('keeps a reference the result can be recalculated from', async () => {
    const weight = 500
    const pheReference = 2.3 * 46 // 105.8, not 106
    const result = await addFoodItem(
      requestEvent({
        name: 'Chicken',
        weight,
        pheReference,
        phe: Math.round((weight * pheReference) / 100),
        kcal: 0
      })
    )

    const stored = day(result.key).log[0] as unknown as { phe: number; pheReference: number }
    expect(stored.phe).toBe(529)
    expect(Math.round((weight * stored.pheReference) / 100)).toBe(stored.phe)
  })
})

describe('free-tier diary limit', () => {
  const fullDiary = (days: number) =>
    Object.fromEntries(
      Array.from({ length: days }, (_, i) => [
        `day${i}`,
        { date: `2026-06-${String(i + 1).padStart(2, '0')}`, phe: 0, kcal: 0, log: [] }
      ])
    )

  it('blocks a free user from starting a 15th day', async () => {
    seedDiary(fullDiary(14))

    await expect(addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))).rejects.toMatchObject(
      {
        statusCode: 403,
        data: { code: 'limit-reached' }
      }
    )
    expect(Object.keys(diary())).toHaveLength(14)
  })

  // The limit counts days, not entries: filling in an existing day must keep
  // working once a free user has reached it.
  it('lets a free user add to an existing day', async () => {
    seedDiary({ ...fullDiary(13), day1: { date: '2026-07-26', phe: 100, kcal: 500, log: [] } })

    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    expect(result).toMatchObject({ key: 'day1', updated: true })
    expect(day('day1').phe).toBe(27)
  })

  it('lets a premium user start a new day past the limit', async () => {
    isPremium = true
    seedDiary(fullDiary(20))

    const result = await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26' }))

    expect(result.updated).toBe(false)
    expect(Object.keys(diary())).toHaveLength(21)
  })
})

describe('community food usage tracking', () => {
  it('counts a use against the community food that was logged', async () => {
    fake = createFakeDatabase({
      'user-1': { pheDiary: {} },
      communityFoods: { food1: { name: 'Rice cake', phe: 60, usageCount: 4 } }
    })

    await addFoodItem(requestEvent({ ...ENTRY, date: '2026-07-26', communityFoodKey: 'food1' }))
    // Usage tracking is fire-and-forget, so let its promise settle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const foods = fake.data.communityFoods as Record<string, { usageCount: number }>
    expect(foods.food1!.usageCount).toBe(5)
  })

  it('still logs the food when the community key no longer exists', async () => {
    const result = await addFoodItem(
      requestEvent({ ...ENTRY, date: '2026-07-26', communityFoodKey: 'deleted' })
    )

    expect(day(result.key).phe).toBe(27)
  })
})
