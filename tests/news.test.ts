import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dateToTime, streakMilestones } from '../app/utils/milestones'
import { parseNewsSeenMarker } from '../app/composables/useNewsSeen'
import { format } from 'date-fns'
import {
  communityFoodAppearsInNews,
  communityFoodNotices,
  hasHiddenFoodsInNews
} from '../app/composables/useNewsContext'
import {
  emptySeen,
  filterNewsItems,
  hasEnoughCommunityItemsForFilter,
  isUnread,
  newsCountToReveal,
  seenAfterVisit,
  utcDayForLocalFormatting,
  visibleNewsItems
} from '../app/utils/news-grouping'

// News combines changelog content with derived store data and browser-local
// read markers.

const changelog = JSON.parse(
  readFileSync(resolve(__dirname, '../content/changelog.json'), 'utf8')
) as Array<{
  revision: number
  publishedAt: string
  category: string
  en?: { title: string; body: string }
  de?: { title: string; body: string }
}>

const CATEGORIES = new Set(['new', 'improved', 'tip'])

describe('browser-local read state', () => {
  it('accepts only a positive safe chronological marker', () => {
    expect(parseNewsSeenMarker('1788170400000')).toBe(1788170400000)
    expect(parseNewsSeenMarker(null)).toBeNull()
    expect(parseNewsSeenMarker('0')).toBeNull()
    expect(parseNewsSeenMarker('not-a-number')).toBeNull()
    expect(parseNewsSeenMarker(Number.MAX_SAFE_INTEGER + 1)).toBeNull()
  })
})

describe('changelog file', () => {
  it('has entries', () => {
    expect(changelog.length).toBeGreaterThan(0)
  })

  // English is the fallback every other language resolves to, so an entry
  // without it renders empty for three of four locales.
  it('gives every entry an English title and body', () => {
    for (const entry of changelog) {
      expect(entry.en?.title?.trim(), entry.publishedAt).toBeTruthy()
      expect(entry.en?.body?.trim(), entry.publishedAt).toBeTruthy()
    }
  })

  it('uses only the categories the app renders', () => {
    for (const entry of changelog) {
      expect(CATEGORIES.has(entry.category), `${entry.publishedAt}: ${entry.category}`).toBe(true)
    }
  })

  // A real publication instant, not a day. It orders notes among every other
  // item and places them against the same chronological read boundary.
  it('stamps every entry with a readable instant', () => {
    for (const entry of changelog) {
      expect(entry.publishedAt, 'instant format').toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(Number.isNaN(new Date(entry.publishedAt).getTime()), entry.publishedAt).toBe(false)
    }
  })

  it('gives every entry one unique positive revision', () => {
    const revisions = changelog.map((entry) => entry.revision)
    expect(new Set(revisions).size, 'revisions are unique').toBe(revisions.length)
    for (const revision of revisions) {
      expect(Number.isSafeInteger(revision), `revision ${revision}`).toBe(true)
      expect(revision).toBeGreaterThan(0)
    }
  })

  it('contains no unfinished helper placeholders', () => {
    for (const entry of changelog) {
      expect(entry.en?.title).not.toBe('TITLE')
      expect(entry.en?.body).not.toBe('One short sentence.')
    }
  })

  it('carries no redundant legacy identity or timestamp fields', () => {
    for (const entry of changelog as unknown as Record<string, unknown>[]) {
      expect(entry.id, String(entry.publishedAt)).toBeUndefined()
      expect(entry.at, String(entry.publishedAt)).toBeUndefined()
      expect(entry.date, String(entry.publishedAt)).toBeUndefined()
    }
  })

  it('has no two entries claiming the same title at the same instant', () => {
    const seen = new Set(changelog.map((entry) => `${entry.publishedAt}::${entry.en?.title}`))
    expect(seen.size).toBe(changelog.length)
  })
})

// News hides poorly rated foods by default, but readers can reveal them for
// feedback. The same toggle applies to contributors and other readers.
describe('which community foods appear', () => {
  const createdAt = Date.UTC(2026, 7, 31, 12)
  const appears = communityFoodAppearsInNews

  it('shows a food in the reader language', () => {
    expect(appears({ language: 'de', likes: 2, createdAt }, 'de')).toBe(true)
  })

  // A food is only searchable in the language it was published in, so showing
  // it elsewhere would advertise something the reader cannot then find.
  it('hides one published in another language', () => {
    expect(appears({ language: 'fr', createdAt }, 'de')).toBe(false)
  })

  it('hides one the community voted out', () => {
    expect(appears({ language: 'de', likes: 0, dislikes: 3, createdAt }, 'de')).toBe(false)
    expect(appears({ language: 'de', likes: 1, dislikes: 3, createdAt }, 'de')).toBe(true)
  })

  it('only reveals contributor foods when the toggle is on, too', () => {
    const food = { language: 'de', dislikes: 3, createdAt, contributorId: 'owner-1' }
    expect(appears(food, 'de')).toBe(false)
    expect(appears(food, 'de', true)).toBe(true)
    expect(appears(food, 'de', false)).toBe(false)
  })

  it('can reveal and hide even a strongly disliked food without changing its rating', () => {
    const food = { language: 'de', likes: 0, dislikes: 100, createdAt, contributorId: 'owner-1' }
    expect(appears(food, 'de')).toBe(false)
    expect(appears(food, 'de', true)).toBe(true)
    expect(appears(food, 'de', false)).toBe(false)
    expect(food.dislikes).toBe(100)
  })

  it('still rejects other languages and invalid timestamps when hidden foods are shown', () => {
    const food = { language: 'de', dislikes: 3, createdAt, contributorId: 'owner-1' }
    expect(appears(food, 'fr', true)).toBe(false)
    expect(appears({ ...food, createdAt: Number.NaN }, 'de', true)).toBe(false)
    expect(appears({ ...food, createdAt: undefined }, 'de', true)).toBe(false)
  })

  it('also keeps a food reachable after its contributor account is removed', () => {
    const food = { language: 'de', dislikes: 3, createdAt }
    expect(appears(food, 'de')).toBe(false)
    expect(appears(food, 'de', true)).toBe(true)
  })

  it('rejects a food whose timestamp could poison the read cursor', () => {
    expect(appears({ language: 'de', createdAt: Number.NaN }, 'de')).toBe(false)
    expect(appears({ language: 'de', createdAt: 'not-a-number' }, 'de')).toBe(false)
  })

  // Deriving the entry from the food is what makes this automatic: a withdrawn
  // food has no record, so it has no entry, with nothing left to clean up.
  it('has nothing to show for a food that no longer exists', () => {
    expect([].filter((food) => appears(food, 'de'))).toHaveLength(0)
  })
})

describe('availability of the hidden-food toggle', () => {
  const food = { language: 'de', createdAt: 100, likes: 0, dislikes: 3 }

  it('appears only when there are rating-hidden foods', () => {
    expect(hasHiddenFoodsInNews([], 'de')).toBe(false)
    expect(hasHiddenFoodsInNews([{ ...food, dislikes: 2 }], 'de')).toBe(false)
    expect(hasHiddenFoodsInNews([{ ...food, likes: 1 }], 'de')).toBe(false)
    expect(hasHiddenFoodsInNews([food], 'de')).toBe(true)
  })

  it('ignores foods in other languages and malformed records that cannot be revealed', () => {
    expect(hasHiddenFoodsInNews([food], 'en')).toBe(false)
    expect(hasHiddenFoodsInNews([{ ...food, createdAt: Number.NaN }], 'de')).toBe(false)
    expect(hasHiddenFoodsInNews([{ ...food, createdAt: undefined }], 'de')).toBe(false)
  })

  it('stays available when the hidden food is shown, for contributors and other readers', () => {
    const contributorFood = { ...food, contributorId: 'owner-1' }
    expect(communityFoodAppearsInNews(contributorFood, 'de', true)).toBe(true)
    expect(hasHiddenFoodsInNews([contributorFood], 'de')).toBe(true)
    expect(hasHiddenFoodsInNews([food], 'de')).toBe(true)
  })
})

describe('contributor feedback notices', () => {
  const food = {
    '.key': 'food1',
    name: 'Rice cakes',
    contributorId: 'owner-1',
    language: 'en',
    createdAt: 100,
    likes: 2,
    dislikes: 4
  }

  it('reports the current net dislikes and the transition to hidden', () => {
    expect(communityFoodNotices([food], 'owner-1')).toEqual([
      {
        key: 'own-flag-food1',
        foodKey: 'food1',
        language: 'en',
        name: 'Rice cakes',
        netDislikes: 2,
        isHidden: false
      }
    ])
    expect(communityFoodNotices([{ ...food, dislikes: 5 }], 'owner-1')[0]).toMatchObject({
      netDislikes: 3,
      isHidden: true
    })
    expect(communityFoodNotices([{ ...food, dislikes: 3 }], 'owner-1')).toEqual([])
  })

  it('only notifies the contributor while they are signed in', () => {
    expect(communityFoodNotices([food], 'reader-2')).toEqual([])
    expect(communityFoodNotices([food], null)).toEqual([])
    expect(communityFoodNotices([food])).toEqual([])
  })

  it('keeps the published language so a notice can link to another locale', () => {
    expect(communityFoodNotices([{ ...food, language: 'fr' }], 'owner-1')[0]).toMatchObject({
      foodKey: 'food1',
      language: 'fr'
    })
  })

  it('does not offer links to malformed records that cannot appear in News', () => {
    expect(
      communityFoodNotices(
        [
          { ...food, '.key': undefined },
          { ...food, createdAt: Number.NaN },
          { ...food, language: 'unknown' }
        ],
        'owner-1'
      )
    ).toEqual([])
  })
})

// Milestones are read out of dates already in the diary. Nothing is stored, so
// the arithmetic is the whole feature: a run counted wrong is a claim about
// someone's own record that they can check.
describe('streak milestones', () => {
  const run = (from: string, days: number) => {
    const start = new Date(`${from}T12:00:00Z`).getTime()
    return Array.from({ length: days }, (_, index) =>
      new Date(start + index * 86400000).toISOString().slice(0, 10)
    )
  }
  const reached = (count: number, date: string) => ({ count, date, createdAt: dateToTime(date) })

  it('finds nothing in a run too short to reach the first mark', () => {
    expect(streakMilestones(run('2026-01-01', 2))).toEqual([])
  })

  it('marks a third day', () => {
    expect(streakMilestones(run('2026-01-01', 3))).toEqual([reached(3, '2026-01-03')])
  })

  it('notifies for a milestone reached after an earlier News visit on the same day', () => {
    const morning = new Date(2026, 0, 3, 9).getTime()
    const afternoon = new Date(2026, 0, 3, 14).getTime()
    const milestones = streakMilestones([
      ...run('2026-01-01', 2),
      { date: '2026-01-03', createdAt: afternoon }
    ])
    expect(milestones).toEqual([{ count: 3, date: '2026-01-03', createdAt: afternoon }])
    const entry = { ...milestones[0]!, key: 'streak-3-2026-01-03' }
    expect(isUnread(entry, { lastReadAt: morning, lastSeenRevision: null })).toBe(true)
    expect(isUnread(entry, seenAfterVisit([entry]))).toBe(false)
  })

  it('does not make a seen milestone unread again when the diary day is edited', () => {
    const createdAt = new Date(2026, 0, 3, 9).getTime()
    const updatedAt = new Date(2026, 0, 3, 14).getTime()
    const day = { date: '2026-01-03', createdAt, updatedAt }
    const [milestone] = streakMilestones([...run('2026-01-01', 2), day])
    expect(milestone?.createdAt).toBe(createdAt)
    expect(
      isUnread(
        { ...milestone!, key: 'streak-3-2026-01-03' },
        { lastReadAt: createdAt, lastSeenRevision: null }
      )
    ).toBe(false)
  })

  it('uses the earliest same-day creation time if legacy days are duplicated', () => {
    const early = new Date(2026, 0, 3, 9).getTime()
    const late = new Date(2026, 0, 3, 14).getTime()
    const entries = [
      ...run('2026-01-01', 2),
      { date: '2026-01-03', createdAt: late },
      { date: '2026-01-03', createdAt: early }
    ]
    const expected = [{ count: 3, date: '2026-01-03', createdAt: early }]
    expect(streakMilestones(entries)).toEqual(expected)
    expect(streakMilestones([...entries].reverse())).toEqual(expected)
  })

  it('keeps invalid, backfilled, and pre-entered timestamps at the calendar date', () => {
    for (const createdAt of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
      new Date(2026, 0, 2, 14).getTime(),
      new Date(2026, 0, 4, 14).getTime()
    ]) {
      expect(
        streakMilestones([...run('2026-01-01', 2), { date: '2026-01-03', createdAt }])
      ).toEqual([reached(3, '2026-01-03')])
    }
  })

  // The day the seventh consecutive entry was made, not the day the run began.
  it('dates a milestone to the day it was reached', () => {
    expect(streakMilestones(run('2026-01-01', 7))).toEqual([
      reached(3, '2026-01-03'),
      reached(7, '2026-01-07')
    ])
  })

  it('passes through every mark a longer run crosses', () => {
    expect(streakMilestones(run('2026-01-01', 30))).toEqual([
      reached(3, '2026-01-03'),
      reached(7, '2026-01-07'),
      reached(14, '2026-01-14'),
      reached(30, '2026-01-30')
    ])
  })

  it('starts again after a gap', () => {
    const dates = [...run('2026-01-01', 7), ...run('2026-01-10', 7)]
    expect(streakMilestones(dates)).toEqual([
      reached(3, '2026-01-03'),
      reached(7, '2026-01-07'),
      reached(3, '2026-01-12'),
      reached(7, '2026-01-16')
    ])
  })

  it('is unmoved by duplicate or unordered dates', () => {
    const dates = [...run('2026-01-01', 7)].reverse()
    dates.push('2026-01-03', '2026-01-03')
    expect(streakMilestones(dates)).toEqual([reached(3, '2026-01-03'), reached(7, '2026-01-07')])
  })

  // A run crossing a month boundary is still a run; date arithmetic has to
  // count days rather than compare strings.
  it('counts across a month end', () => {
    expect(streakMilestones(run('2026-01-28', 7))).toEqual([
      reached(3, '2026-01-30'),
      reached(7, '2026-02-03')
    ])
  })

  it('ignores entries with no date at all', () => {
    expect(streakMilestones([undefined, '', ...run('2026-01-01', 7)])).toEqual([
      reached(3, '2026-01-03'),
      reached(7, '2026-01-07')
    ])
  })

  it('ignores malformed legacy dates instead of producing an invalid milestone', () => {
    expect(streakMilestones(['not-a-date', '2026-02-30', ...run('2026-01-01', 3)])).toEqual([
      reached(3, '2026-01-03')
    ])
  })

  it('keeps a backfilled streak at its calendar date despite timestamps on other days', () => {
    const backfilled = [
      { date: '2026-01-01', createdAt: 100 },
      { date: '2026-01-02', createdAt: Date.UTC(2030, 0, 1) },
      { date: '2026-01-03', createdAt: 300 }
    ]

    expect(streakMilestones(backfilled)).toEqual([reached(3, '2026-01-03')])
  })

  it('places a calendar milestone at local midnight rather than in the future', () => {
    expect(dateToTime('2026-01-03')).toBe(new Date(2026, 0, 3).getTime())
    expect(dateToTime('2026-01-03')).toBeLessThanOrEqual(new Date(2026, 0, 3, 0, 1).getTime())
  })
})

// Time covers ordinary chronological entries. Revision independently covers a
// release note that is deployed after its displayed publication time.
describe('what counts as unread', () => {
  const NOW = Date.UTC(2026, 7, 31, 12)
  const daysAgo = (days: number) => NOW - days * 24 * 60 * 60 * 1000
  const item = (key: string, createdAt: number, revision?: number) => ({
    key,
    createdAt,
    revision
  })

  it('marks ordinary entries unread when there has been no visit', () => {
    expect(isUnread(item('latest', daysAgo(1)), emptySeen())).toBe(true)
    expect(isUnread(item('older', daysAgo(200)), emptySeen())).toBe(true)
  })

  it('never marks a food shared by the current reader unread', () => {
    const food = { ...item('own-food', daysAgo(1)), isOwn: true }
    expect(isUnread(food, emptySeen())).toBe(false)
    expect(isUnread(food, { lastReadAt: daysAgo(2), lastSeenRevision: null })).toBe(false)
  })

  it('still marks a newer food shared by another reader unread', () => {
    const food = { ...item('community-food', daysAgo(1)), isOwn: false }
    expect(isUnread(food, emptySeen())).toBe(true)
    expect(isUnread(food, { lastReadAt: daysAgo(2), lastSeenRevision: null })).toBe(true)
  })

  it('never marks a rating-hidden food unread, even when manually revealed', () => {
    const food = { ...item('hidden-food', daysAgo(1)), isHidden: true }
    expect(isUnread(food, emptySeen())).toBe(false)
    expect(isUnread(food, { lastReadAt: daysAgo(2), lastSeenRevision: null })).toBe(false)
    expect(isUnread({ ...food, isHidden: false }, emptySeen())).toBe(true)
  })

  it('calls only items newer than the last chronological marker unread', () => {
    const seen = { lastReadAt: daysAgo(5), lastSeenRevision: 10 }
    expect(isUnread(item('new-note', daysAgo(2)), seen)).toBe(true)
    expect(isUnread(item('seen-food', daysAgo(5)), seen)).toBe(false)
    expect(isUnread(item('older-streak', daysAgo(20)), seen)).toBe(false)
  })

  it('keeps a late-deployed release note unread through its revision', () => {
    const seen = { lastReadAt: daysAgo(5), lastSeenRevision: 10 }
    expect(isUnread(item('late-note', daysAgo(20), 11), seen)).toBe(true)
    expect(isUnread(item('seen-note', daysAgo(20), 10), seen)).toBe(false)
  })
})

describe('what a visit records', () => {
  const item = (key: string, createdAt: number, revision?: number) => ({
    key,
    createdAt,
    revision
  })

  it('records the newest time and release-note revision independently', () => {
    expect(
      seenAfterVisit([
        item('newer-food', 500),
        item('backdated-note', 10, 117),
        item('streak', 200)
      ])
    ).toEqual({ lastReadAt: 500, lastSeenRevision: 117 })
  })

  it('copes with nothing to record', () => {
    expect(seenAfterVisit([])).toEqual(emptySeen())
  })

  it('ignores an invalid timestamp instead of freezing the marker at NaN', () => {
    expect(seenAfterVisit([item('valid', 500), item('invalid', Number.NaN)])).toEqual({
      lastReadAt: 500,
      lastSeenRevision: null
    })
    expect(isUnread(item('invalid', Number.NaN), emptySeen())).toBe(false)
  })
})

describe('feed pagination', () => {
  const items = Array.from({ length: 116 }, (_, index) => index)

  it('mounts only the requested page for a signed-in feed', () => {
    expect(visibleNewsItems(items, 20, true)).toEqual(items.slice(0, 20))
  })

  it('keeps the complete public changelog for signed-out readers and crawlers', () => {
    expect(visibleNewsItems(items, 20, false)).toEqual(items)
  })
})

describe('revealing a food from a notice', () => {
  const items = Array.from({ length: 45 }, (_, index) => ({ key: `food-${index}` }))

  it('includes an older target beyond the first page', () => {
    const count = newsCountToReveal(items, 20, 'food-35')
    expect(count).toBe(36)
    expect(visibleNewsItems(items, count!, true)).toContainEqual({ key: 'food-35' })
  })

  it('keeps already revealed items visible when the target is near the top', () => {
    expect(newsCountToReveal(items, 40, 'food-2')).toBe(40)
  })

  it('does not change pagination for a food that has been removed', () => {
    expect(newsCountToReveal(items, 20, 'removed')).toBeNull()
  })
})

describe('post-type filters', () => {
  const food = (key: number) => ({ key: `food-${key}`, kind: 'food-shared' as const })
  const note = { key: 'note-1', kind: 'note' as const }
  const streak = { key: 'streak-3', kind: 'streak' as const }

  it('offers a Community filter once it reaches the minimum useful size', () => {
    expect(
      hasEnoughCommunityItemsForFilter([note, ...Array.from({ length: 4 }, (_, i) => food(i))])
    ).toBe(false)
    expect(
      hasEnoughCommunityItemsForFilter([note, ...Array.from({ length: 5 }, (_, i) => food(i))])
    ).toBe(true)
  })

  it('filters the real post kinds without changing their order', () => {
    const items = [food(1), note, streak, food(2)]
    expect(filterNewsItems(items, 'all')).toEqual(items)
    expect(filterNewsItems(items, 'food-shared').map((item) => item.key)).toEqual([
      'food-1',
      'food-2'
    ])
    expect(filterNewsItems(items, 'note')).toEqual([note])
    expect(filterNewsItems(items, 'streak')).toEqual([streak])
  })
})

// Read status is decoration, not a grouping operation: a backdated unread note
// stays between the entries immediately newer and older than its date.
describe('chronological ordering', () => {
  const NOW = Date.UTC(2026, 7, 31, 12)
  const at = (days: number) => NOW - days * 24 * 60 * 60 * 1000
  const item = (key: string, days: number, revision?: number) => ({
    key,
    createdAt: at(days),
    revision
  })

  it('does not move a backdated unread note out of date order', () => {
    const items = [item('newer-food', 1), item('late-note', 10, 117), item('older-food', 20)]
    const seen = { lastReadAt: at(5), lastSeenRevision: 116 }

    expect(items.map((entry) => entry.key)).toEqual(['newer-food', 'late-note', 'older-food'])
    expect(items.filter((entry) => isUnread(entry, seen)).map((entry) => entry.key)).toEqual([
      'newer-food',
      'late-note'
    ])
  })
})

// The first render must not depend on where the reader is. The server has no
// timezone to speak of, so an instant formatted locally there and locally in the
// browser can name two different days for the same node.
describe('timezone-free first render', () => {
  it('reads an instant as the same day whatever the reader timezone', () => {
    const instant = new Date('2026-08-28T15:10:55Z')
    expect(format(utcDayForLocalFormatting(instant), 'yyyy-MM-dd')).toBe('2026-08-28')
  })

  it('does not assume the offset survives crossing a DST boundary', () => {
    const instant = new Date('2026-04-24T00:00:00Z')
    expect(format(utcDayForLocalFormatting(instant), 'yyyy-MM-dd')).toBe('2026-04-24')
  })

  // The failure this prevents, spelled out: the same instant is already the next
  // day past UTC+12.
  it('would name a different day if formatted locally past UTC+12', () => {
    const local = new Date('2026-08-28T15:10:55Z').toLocaleDateString('en-CA', {
      timeZone: 'Pacific/Kiritimati'
    })
    expect(local).toBe('2026-08-29')
  })
})
