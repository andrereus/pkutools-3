import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { NewsEntry, Notice } from '../app/composables/useNewsContext'
import { useNewsBadge } from '../app/composables/useNewsBadge'
import { streakMilestones } from '../app/utils/milestones'

const context = {
  foodEntries: ref<NewsEntry[]>([]),
  milestoneEntries: ref<NewsEntry[]>([]),
  notices: ref<Notice[]>([])
}
const seen = {
  ready: ref(true),
  lastReadAt: ref<number | null>(null),
  lastSeenRevision: ref<number | null>(null)
}

vi.mock('../app/composables/useNewsContext', () => ({ useNewsContext: () => context }))

beforeEach(() => {
  context.foodEntries.value = []
  context.milestoneEntries.value = []
  context.notices.value = []
  seen.ready.value = true
  seen.lastReadAt.value = null
  seen.lastSeenRevision.value = null
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useNewsSeen', () => seen)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: {} }))
})

afterEach(() => vi.unstubAllGlobals())

const hiddenNotice: Notice = {
  key: 'own-flag-food1',
  foodKey: 'food1',
  language: 'en',
  name: 'Rice cakes',
  netDislikes: 3,
  isHidden: true
}

describe('News unread badge', () => {
  it('does not notify for a hidden food, its contributor notice, or both', () => {
    const { hasUnread } = useNewsBadge()
    context.foodEntries.value = [
      { key: 'food1', kind: 'food-shared', createdAt: 100, isOwn: true, isHidden: true }
    ]
    expect(hasUnread.value).toBe(false)
    context.notices.value = [hiddenNotice]
    expect(hasUnread.value).toBe(false)
    context.foodEntries.value = []
    expect(hasUnread.value).toBe(false)
  })

  it('does not notify for negative feedback, whether the food is hidden or not', () => {
    const { hasUnread } = useNewsBadge()
    context.notices.value = [{ ...hiddenNotice, netDislikes: 2, isHidden: false }]
    expect(hasUnread.value).toBe(false)
    context.notices.value = [hiddenNotice]
    expect(hasUnread.value).toBe(false)
  })

  it('still notifies for new posts alongside a non-hidden feedback warning', () => {
    const { hasUnread } = useNewsBadge()
    context.notices.value = [{ ...hiddenNotice, netDislikes: 2, isHidden: false }]
    context.foodEntries.value = [
      { key: 'visible-food', kind: 'food-shared', createdAt: 100, isOwn: false }
    ]
    expect(hasUnread.value).toBe(true)
    seen.lastReadAt.value = 100
    expect(hasUnread.value).toBe(false)
    expect(context.notices.value).toHaveLength(1)
  })

  it('still notifies for other unread posts while a hidden notice exists', () => {
    const { hasUnread } = useNewsBadge()
    context.notices.value = [hiddenNotice]
    context.foodEntries.value = [
      { key: 'visible-food', kind: 'food-shared', createdAt: 100, isHidden: false }
    ]
    expect(hasUnread.value).toBe(true)
    seen.lastReadAt.value = 100
    expect(hasUnread.value).toBe(false)
  })

  it('preserves release-note notifications', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { changelogLatestAt: 100, changelogLatestRevision: 1 }
    }))
    context.notices.value = [hiddenNotice]
    const { hasUnread } = useNewsBadge()
    expect(hasUnread.value).toBe(true)
    seen.lastReadAt.value = 100
    seen.lastSeenRevision.value = 1
    expect(hasUnread.value).toBe(false)
  })

  it('notifies when a milestone is reached after a News visit earlier that day', () => {
    seen.lastReadAt.value = new Date(2026, 0, 3, 9).getTime()
    const { hasUnread } = useNewsBadge()
    expect(hasUnread.value).toBe(false)

    const createdAt = new Date(2026, 0, 3, 14).getTime()
    context.milestoneEntries.value = streakMilestones([
      '2026-01-01',
      '2026-01-02',
      { date: '2026-01-03', createdAt }
    ]).map((milestone) => ({
      ...milestone,
      key: `streak-${milestone.count}-${milestone.date}`,
      kind: 'streak'
    }))

    expect(hasUnread.value).toBe(true)
    seen.lastReadAt.value = createdAt
    expect(hasUnread.value).toBe(false)
  })

  it('waits for read-state restoration before notifying', () => {
    context.notices.value = [{ ...hiddenNotice, netDislikes: 2, isHidden: false }]
    context.foodEntries.value = [
      { key: 'visible-food', kind: 'food-shared', createdAt: 100, isOwn: false }
    ]
    seen.ready.value = false
    const { hasUnread } = useNewsBadge()
    expect(hasUnread.value).toBe(false)
    seen.ready.value = true
    expect(hasUnread.value).toBe(true)
  })
})
