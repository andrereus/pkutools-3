import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'

// Milestones worked out from dates already in the diary, so they need nothing
// stored and nothing written.
//
// Each one has a real date — the day the run reached seven — and that date is
// also its position in the chronological list and against the read cursor.
// Derived means they also stay honest:
// delete a diary day in the middle of a run and the milestones after it move or
// disappear, because they were never anything but a reading of the data.

/**
 * Days logged in a row worth marking.
 *
 * Deliberately easy to start. These exist to encourage someone into a habit,
 * not to certify one, and a first marker three days in reaches the person who
 * most needs it — the one still deciding whether logging is worth keeping up.
 * Somebody already logging daily for a year is not who the ladder is for.
 *
 * It stops at a year because there is nothing useful left to say past it.
 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365]

export interface Milestone {
  /** Days logged in a row. */
  count: number
  /** The day it was reached, as YYYY-MM-DD. */
  date: string
  /** Stable timestamp derived from `date`, for the shared feed ordering. */
  createdAt: number
}

export interface MilestoneDay {
  date?: string
}

/**
 * A date-only entry has no real instant. Local midnight puts it at the start of
 * the reader's named calendar day and, for today, can never move the read cursor
 * into the future. It is used only for ordering and the chronological cursor;
 * the UI displays `date` itself.
 */
export const dateToTime = (date: string) => new Date(`${date}T00:00:00`).getTime()

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
 * A run that reaches thirty passes seven and fourteen on the way, and each of
 * those happened on its own day, so each is its own milestone. A run only
 * reaches a given length once, so a milestone repeats only if the streak breaks
 * and is built again — which is a thing that happened too, and worth saying.
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
    // The `index > 0` guard is load-bearing. There is no day before the first
    // one, and hand-rolled arithmetic used to paper over that by comparing
    // against NaN — which is never equal to anything, so it happened to behave.
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
          // A backfilled historical run remains a historical event. Using the
          // same date for display, order, and unread status keeps one coherent
          // chronological rule and prevents row timestamps moving the cursor.
          createdAt: dateToTime(date)
        })
      }
      runStart = index
    }
  }

  return milestones
}
