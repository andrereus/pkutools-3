import { format } from 'date-fns'
import { newsEntryTimestamp } from './news-grouping'

// What happened on one diary day, in the order the diary lists it: the
// reader's own milestone first, then everything else newest first.

interface DigestEntry {
  key: string
  kind: string
  createdAt: number
  contentUpdatedAt?: unknown
  /** The calendar day, for entries that have one rather than an instant. */
  date?: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The calendar day an entry belongs to, in the reader's time zone. */
export const entryDay = (entry: DigestEntry): string =>
  entry.date ?? format(new Date(newsEntryTimestamp(entry)), 'yyyy-MM-dd')

const inDigestOrder = <T extends DigestEntry>(entries: T[]): T[] =>
  entries.sort(
    (left, right) =>
      Number(right.kind === 'streak') - Number(left.kind === 'streak') ||
      newsEntryTimestamp(right) - newsEntryTimestamp(left)
  )

export const entriesOfDay = <T extends DigestEntry>(entries: readonly T[], day: string): T[] =>
  inDigestOrder(entries.filter((entry) => entryDay(entry) === day))

/**
 * Today looks back 24 hours rather than to midnight, so last evening is still
 * there in the morning. Entries dated by calendar day stay on their day.
 */
export const entriesOfToday = <T extends DigestEntry>(entries: readonly T[], now: number): T[] =>
  inDigestOrder(
    entries.filter((entry) =>
      entry.date
        ? entry.date === format(new Date(now), 'yyyy-MM-dd')
        : newsEntryTimestamp(entry) > now - DAY_MS
    )
  )
