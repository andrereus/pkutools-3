import { useNewsContext } from './useNewsContext'
import { isUnread } from '../utils/news-grouping'

/**
 * Whether the bell shows a dot — for the header, on every page.
 *
 * The changelog reduces to its newest publication date and revision at build
 * time rather than being imported here, so a file that only grows is not
 * shipped to someone looking at their diary.
 *
 * Derived notices keep the dot active while their underlying condition holds.
 */
export const useNewsBadge = () => {
  const { foodEntries, milestoneEntries, notices } = useNewsContext()
  const seenState = useNewsSeen()
  const config = useRuntimeConfig().public
  const newestNoteAt = Number(config.changelogLatestAt ?? 0)
  const newestNoteRevision = Number(config.changelogLatestRevision ?? 0)

  const hasUnread = computed(() => {
    const newestNote = {
      key: 'latest-note',
      createdAt: newestNoteAt,
      revision: newestNoteRevision
    }

    // Wait for browser storage to avoid a hydration mismatch.
    if (!seenState.ready.value) return false
    if (notices.value.length > 0) return true

    const seen = {
      lastReadAt: seenState.lastReadAt.value,
      lastSeenRevision: seenState.lastSeenRevision.value
    }

    return (
      (newestNoteAt > 0 && isUnread(newestNote, seen)) ||
      [...foodEntries.value, ...milestoneEntries.value].some((entry) => isUnread(entry, seen))
    )
  })

  return { hasUnread }
}
