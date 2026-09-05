import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'

// Derives streak milestones from diary calendar dates without persisted state.

/** Days logged in a row that produce milestones. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365]

export interface Milestone {
  /** Days logged in a row. */
  count: number
  /** The day it was reached, as YYYY-MM-DD. */
  date: string
  /** When the final day was first logged, or its calendar date for legacy/backfilled days. */
  createdAt: number
}

export interface MilestoneDay {
  date?: string
  createdAt?: number
}

/**
 * A date-only entry has no real instant. Local midnight puts it at the start of
 * the reader's named calendar day and, for today, can never move the read cursor
 * into the future. Used when no same-day creation time is available;
 * the UI displays `date` itself.
 */
export const dateToTime = (date: string) => new Date(`${date}T00:00:00`).getTime()

/** Use the final day's first save time without resurfacing historical backfills. */
const milestoneTime = (date: string, entries: (string | MilestoneDay | undefined)[]): number => {
  const dayStart = dateToTime(date)
  const nextDay = new Date(dayStart)
  nextDay.setDate(nextDay.getDate() + 1)
  let firstRecordedAt: number | undefined

  for (const entry of entries) {
    if (!entry || typeof entry === 'string' || entry.date !== date) continue
    const recordedAt = entry.createdAt
    if (
      typeof recordedAt !== 'number' ||
      !Number.isSafeInteger(recordedAt) ||
      recordedAt < dayStart ||
      recordedAt >= nextDay.getTime()
    )
      continue
    firstRecordedAt = Math.min(firstRecordedAt ?? recordedAt, recordedAt)
  }

  return firstRecordedAt ?? dayStart
}

/** Valid calendar dates, sorted and deduplicated. */
const sortedDays = (entries: (string | MilestoneDay | undefined)[]): string[] => {
  const dates = new Set<string>()

  for (const entry of entries) {
    const date = typeof entry === 'string' ? entry : entry?.date
    if (!date || !isValid(parseISO(date))) continue
    dates.add(date)
  }

  return [...dates].sort((left, right) => left.localeCompare(right))
}

/**
 * The day each streak milestone was reached.
 *
 * Each threshold is dated to the day it was reached. A repeated streak can
 * therefore produce the same threshold again on a later date.
 */
export const streakMilestones = (entries: (string | MilestoneDay | undefined)[]): Milestone[] => {
  const days = sortedDays(entries)
  if (days.length === 0) return []

  const milestones: Milestone[] = []
  let runStart = 0

  for (let index = 0; index <= days.length; index += 1) {
    // Calendar days apart, not milliseconds: date-fns is what the rest of the
    // app parses dates with, and it counts the day boundary rather than a fixed
    // number of hours, so a run is not broken by a daylight saving change.
    //
    // There is no previous day at index zero.
    const isBreak =
      index === days.length ||
      (index > 0 &&
        differenceInCalendarDays(parseISO(days[index]!), parseISO(days[index - 1]!)) !== 1)

    if (index > 0 && isBreak) {
      const length = index - runStart
      for (const count of STREAK_MILESTONES) {
        if (count > length) break
        const date = days[runStart + count - 1]!
        milestones.push({
          count,
          date,
          // A same-day save can follow a morning News visit. Use that instant
          // for unread status; historical backfills retain their calendar date.
          createdAt: milestoneTime(date, entries)
        })
      }
      runStart = index
    }
  }

  return milestones
}
