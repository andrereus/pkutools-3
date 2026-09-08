import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useNews } from '../app/composables/useNews'
import {
  hasContentUpdate,
  isUnread,
  newsEntryTimestamp,
  seenAfterVisit
} from '../app/utils/news-grouping'

const { store } = vi.hoisted(() => ({ store: { current: {} as Record<string, unknown> } }))
vi.mock('../stores/index', () => ({ useStore: () => store.current }))

beforeEach(() => {
  store.current = reactive({ user: { id: 'reader' }, communityFoods: [], pheDiary: [] })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('onMounted', () => {})
  vi.stubGlobal('onUnmounted', () => {})
  vi.stubGlobal('useI18n', () => ({ locale: ref('en') }))
})
afterEach(() => vi.unstubAllGlobals())

describe('food content updates in News', () => {
  it('uses a food edit consistently for feed order, displayed date and read state', () => {
    const { items } = useNews()
    const latestPostTime = Math.max(...items.value.map((item) => item.createdAt))
    const oldFoodTime = latestPostTime - 1000
    store.current.communityFoods = [
      {
        '.key': 'food1',
        name: 'Rice cake',
        language: 'en',
        createdAt: oldFoodTime,
        updatedAt: latestPostTime + 5000,
        contributorId: 'author'
      }
    ]
    expect(items.value[0]!.kind).toBe('note')
    const previousVisit = { lastReadAt: latestPostTime, lastSeenRevision: 999 }
    expect(
      isUnread(
        items.value.find((item) => item.key === 'food-food1')!,
        previousVisit
      )
    ).toBe(false)
    const food = (store.current.communityFoods as Record<string, unknown>[])[0]!
    food.contentUpdatedAt = latestPostTime + 1000
    expect(hasContentUpdate(food)).toBe(true)

    expect(items.value[0]).toMatchObject({ key: 'food-food1', createdAt: oldFoodTime })
    expect(newsEntryTimestamp(items.value[0]!)).toBe(latestPostTime + 1000)
    expect(items.value.filter((item) => item.key === 'food-food1')).toHaveLength(1)
    expect(isUnread(items.value[0]!, previousVisit)).toBe(true)
    const nextVisit = seenAfterVisit(items.value)
    expect(nextVisit.lastReadAt).toBe(latestPostTime + 1000)
    expect(isUnread(items.value[0]!, nextVisit)).toBe(false)

    // Votes/comments/technical writes neither move the card nor make it unread.
    Object.assign(food, { commentCount: 1, likes: 2, updatedAt: latestPostTime + 9000 })
    expect(newsEntryTimestamp(items.value[0]!)).toBe(latestPostTime + 1000)
    expect(isUnread(items.value[0]!, nextVisit)).toBe(false)
    expect(seenAfterVisit(items.value)).toEqual(nextVisit)

    // A later content edit can introduce the same food again after that visit.
    food.contentUpdatedAt = latestPostTime + 2000
    expect(isUnread(items.value[0]!, nextVisit)).toBe(true)
    expect(seenAfterVisit(items.value).lastReadAt).toBe(latestPostTime + 2000)
  })

  it.each([
    undefined,
    null,
    '200',
    true,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
    100.5,
    -1,
    0,
    100,
    50
  ])('uses publication time for legacy or invalid content timestamps: %s', (contentUpdatedAt) => {
    store.current.communityFoods = [
      {
        '.key': 'food1',
        name: 'Rice cake',
        language: 'en',
        createdAt: 100,
        contentUpdatedAt
      }
    ]
    const entry = useNews().items.value.find((item) => item.key === 'food-food1')!
    expect(newsEntryTimestamp(entry)).toBe(100)
    expect(hasContentUpdate({ createdAt: 100, contentUpdatedAt })).toBe(false)
    expect(isUnread(entry, { lastReadAt: 99, lastSeenRevision: null })).toBe(true)
    expect(isUnread(entry, { lastReadAt: 100, lastSeenRevision: null })).toBe(false)
    expect(seenAfterVisit([entry])).toEqual({ lastReadAt: 100, lastSeenRevision: null })
  })

  it.each([undefined, null, '100', true, 100.5, Number.NaN])(
    'does not advertise history on a food with an invalid publication time: %s',
    (createdAt) => {
      expect(hasContentUpdate({ createdAt, contentUpdatedAt: 200 })).toBe(false)
    }
  )

  it('keeps own edited foods visible without unread decoration', () => {
    store.current.communityFoods = [
      {
        '.key': 'food1',
        name: 'Rice cake',
        language: 'en',
        createdAt: 100,
        contentUpdatedAt: 200,
        contributorId: 'reader'
      }
    ]
    const entry = useNews().items.value.find((item) => item.key === 'food-food1')!
    expect(newsEntryTimestamp(entry)).toBe(200)
    expect(isUnread(entry, { lastReadAt: null, lastSeenRevision: null })).toBe(false)
  })
})
