import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'user-1' }))

const updateFoodItem = (await import('../server/api/diary/food-items/[key].put'))
  .default as unknown as (event: unknown) => Promise<{ key: string }>
const deleteFoodItem = (await import('../server/api/diary/food-items/[key].delete'))
  .default as unknown as (event: unknown) => Promise<{ key: string; deletedLogIndex: number }>

const FIRST = { itemId: '-Nfirst', name: 'Bread', weight: 100, phe: 100, kcal: 250 }
const SECOND = { itemId: '-Nsecond', name: 'Cheese', weight: 100, phe: 200, kcal: 350 }

const seed = (log: Array<Record<string, unknown>> = [FIRST, SECOND]) => {
  fake = createFakeDatabase({
    'user-1': {
      pheDiary: {
        day1: { date: '2026-08-05', phe: 300, kcal: 600, log }
      }
    }
  })
}

const storedDay = () =>
  (
    fake.data['user-1'] as {
      pheDiary: {
        day1: { phe: number; kcal: number; log: Array<Record<string, unknown>> }
      }
    }
  ).pheDiary.day1

beforeEach(() => seed())

describe('stable diary item identity', () => {
  it('updates the matching id instead of a stale index', async () => {
    await updateFoodItem(
      requestEvent(
        {
          itemId: '-Nsecond',
          logIndex: 0,
          entry: { ...SECOND, name: 'Cheese edited', phe: 210 }
        },
        {},
        { key: 'day1' }
      )
    )

    expect(storedDay().log[0]).toMatchObject(FIRST)
    expect(storedDay().log[1]).toMatchObject({
      itemId: '-Nsecond',
      name: 'Cheese edited',
      phe: 210
    })
    expect(storedDay()).toMatchObject({ phe: 310, kcal: 600 })
  })

  it('deletes the matching id instead of a stale index', async () => {
    const result = await deleteFoodItem(
      requestEvent({ itemId: '-Nsecond', logIndex: 0 }, {}, { key: 'day1' })
    )

    expect(result.deletedLogIndex).toBe(1)
    expect(storedDay().log).toEqual([FIRST])
    expect(storedDay()).toMatchObject({ phe: 100, kcal: 250 })
  })

  it('normalizes legacy numeric strings after editing an item', async () => {
    seed([{ ...FIRST, phe: '100', kcal: '250' }, SECOND])

    await updateFoodItem(
      requestEvent(
        {
          itemId: '-Nsecond',
          entry: { ...SECOND, phe: 210 }
        },
        {},
        { key: 'day1' }
      )
    )

    expect(storedDay()).toMatchObject({ phe: 310, kcal: 600 })
    expect(typeof storedDay().phe).toBe('number')
    expect(typeof storedDay().kcal).toBe('number')
  })

  it('normalizes remaining legacy numeric strings after deleting an item', async () => {
    seed([{ ...FIRST, phe: '100', kcal: '250' }, SECOND])

    await deleteFoodItem(requestEvent({ itemId: '-Nsecond' }, {}, { key: 'day1' }))

    expect(storedDay()).toMatchObject({ phe: 100, kcal: 250 })
    expect(typeof storedDay().phe).toBe('number')
    expect(typeof storedDay().kcal).toBe('number')
  })

  it('does not fall back to an index when a supplied id is unknown', async () => {
    await expect(
      deleteFoodItem(requestEvent({ itemId: '-Nmissing', logIndex: 0 }, {}, { key: 'day1' }))
    ).rejects.toMatchObject({
      statusCode: 404,
      data: { code: 'diary-item-not-found' }
    })

    expect(storedDay().log).toEqual([FIRST, SECOND])
  })

  it('keeps index lookup for a legacy item without an id', async () => {
    const first = { name: 'Bread', weight: 100, phe: 100, kcal: 250 }
    const second = { name: 'Cheese', weight: 100, phe: 200, kcal: 350 }
    seed([first, second])

    await deleteFoodItem(requestEvent({ logIndex: 1 }, {}, { key: 'day1' }))

    expect(storedDay().log).toEqual([first])
  })

  it('refuses to guess when stored ids are duplicated', async () => {
    seed([FIRST, { ...SECOND, itemId: '-Nfirst' }])

    await expect(
      deleteFoodItem(requestEvent({ itemId: '-Nfirst' }, {}, { key: 'day1' }))
    ).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'duplicate-diary-item-id' }
    })

    expect(storedDay().log).toHaveLength(2)
  })
})
