// Ordering and unread state are deliberately separate. Every item is ordered by
// `createdAt`; release notes additionally carry a monotonic revision so a note
// deployed after its displayed date can still be new without moving it out of
// chronological position.

export interface SeenEntry {
  key: string
  createdAt: number
  revision?: number
}

export interface SeenState {
  lastReadAt: number | null
  lastSeenRevision: number | null
}

export const emptySeen = (): SeenState => ({ lastReadAt: null, lastSeenRevision: null })

/** Values safe to compare, persist, and pass to Date. */
export const isNewsTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/**
 * A timestamp covers ordinary chronological events. A release-note revision is
 * a second, independent check for a note that first appears behind that time.
 */
export const isUnread = (entry: SeenEntry, seen: SeenState): boolean => {
  const newerThanTime =
    isNewsTimestamp(entry.createdAt) &&
    (seen.lastReadAt === null || entry.createdAt > seen.lastReadAt)
  const newerRevision =
    isNewsTimestamp(entry.revision) &&
    (seen.lastSeenRevision === null || entry.revision > seen.lastSeenRevision)

  return newerThanTime || newerRevision
}

/** The two monotonic positions covered by a visit. */
export const seenAfterVisit = (items: SeenEntry[]): SeenState => {
  const seen = emptySeen()
  for (const item of items) {
    if (isNewsTimestamp(item.createdAt)) {
      seen.lastReadAt =
        seen.lastReadAt === null ? item.createdAt : Math.max(seen.lastReadAt, item.createdAt)
    }
    if (isNewsTimestamp(item.revision)) {
      seen.lastSeenRevision =
        seen.lastSeenRevision === null
          ? item.revision
          : Math.max(seen.lastSeenRevision, item.revision)
    }
  }
  return seen
}

/** Signed-in feeds page; the public changelog remains complete for crawlers. */
export const visibleNewsItems = <T>(items: readonly T[], count: number, paginate: boolean): T[] =>
  paginate ? items.slice(0, count) : [...items]

/**
 * Stable server-rendered calendar day for a real instant. The browser switches
 * to local formatting after hydration.
 */
export const utcDayForLocalFormatting = (value: Date): Date =>
  new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12)
