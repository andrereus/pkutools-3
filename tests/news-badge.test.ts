import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { NewsEntry, Notice } from '../app/composables/useNewsContext'
import { useNewsBadge } from '../app/composables/useNewsBadge'

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

  it('still notifies for a questioned food that is not hidden, then clears when hidden', () => {
    const { hasUnread } = useNewsBadge()
    context.notices.value = [{ ...hiddenNotice, netDislikes: 2, isHidden: false }]
    expect(hasUnread.value).toBe(true)
    context.notices.value = [hiddenNotice]
    expect(hasUnread.value).toBe(false)
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

  it('waits for read-state restoration before notifying', () => {
    context.notices.value = [{ ...hiddenNotice, netDislikes: 2, isHidden: false }]
    seen.ready.value = false
    const { hasUnread } = useNewsBadge()
    expect(hasUnread.value).toBe(false)
    seen.ready.value = true
    expect(hasUnread.value).toBe(true)
  })
})
