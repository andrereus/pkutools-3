import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

// The day's Phe total is the number a user doses against, and it sits above the
// list of items it is supposed to be the sum of. This route can write that total
// without adding the items up, so these tests pin the one rule that decides
// when it may take the client's word for it: only when there are no items.

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'user-1' }))

const updateDay = (await import('../server/api/diary/days/[key].put')).default as unknown as (
  event: unknown
) => Promise<{ key: string; updated: boolean }>

const ITEM = (name: string, phe: number, kcal: number) => ({ name, weight: 100, phe, kcal })

const seed = (day: Record<string, unknown>) => {
  fake = createFakeDatabase({ 'user-1': { pheDiary: { day1: day } } })
}

const day = () =>
  (fake.data['user-1'] as { pheDiary: Record<string, Record<string, unknown>> }).pheDiary.day1 as {
    phe: number
    kcal: number
  }

const put = (body: unknown) => updateDay(requestEvent(body, {}, { key: 'day1' }))

beforeEach(() => {
  seed({ date: '2026-07-28', phe: 100, kcal: 500, log: [ITEM('Bread', 100, 500)] })
})

describe('a day that carries items', () => {
  it('totals the items rather than trusting the request', async () => {
    // A client that edits the log but forgets the header would otherwise have
    // its stale total stored verbatim.
    await put({
      date: '2026-07-28',
      phe: 9999,
      kcal: 9999,
      log: [ITEM('Apple', 27, 78), ITEM('Cheese', 112, 300)]
    })

    expect(day()).toMatchObject({ phe: 139, kcal: 378 })
  })

  it('recomputes after an item is removed', async () => {
    await put({ date: '2026-07-28', phe: 100, kcal: 500, log: [ITEM('Apple', 27, 78)] })

    expect(day()).toMatchObject({ phe: 27, kcal: 78 })
  })
})

// A manual entry records a total without listing the foods, so there is nothing
// to derive it from and the submitted value is the data. The diet report sends
// an empty array rather than omitting the key, so both shapes have to hold.
describe('a day with no items', () => {
  it('keeps the submitted total when the log is empty', async () => {
    seed({ date: '2026-07-28', phe: 0, kcal: 0 })

    await put({ date: '2026-07-28', phe: 300, kcal: 1200, log: [] })

    expect(day()).toMatchObject({ phe: 300, kcal: 1200 })
  })

  it('ignores the submitted total when no log is sent at all', async () => {
    // The diary's "incomplete" toggle sends the total it happens to be holding
    // and no log. A stale client would otherwise overwrite the stored total of
    // items it has never seen, which is the drift this route exists to prevent.
    await put({ date: '2026-07-28', phe: 9999, kcal: 9999, incomplete: true })

    expect(day()).toMatchObject({ phe: 100, kcal: 500, incomplete: true })
  })

  it('leaves the stored items alone when no log is sent', async () => {
    await put({ date: '2026-07-28', phe: 9999, kcal: 9999, incomplete: true })

    expect((day() as unknown as { log: unknown[] }).log).toHaveLength(1)
  })
})
