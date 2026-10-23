import { useNewsContext } from './useNewsContext'
import { isUnread } from '../utils/news-grouping'

/**
 * Whether the bell shows a dot — for the header, on every page.
 *
 * Of the release notes it only asks the server for the newest one's time and
 * revision, on start and on every page change, so a note published while the
 * app stays open still lights the dot, without loading every note everywhere.
 *
 * Rating warnings do not trigger a dot; new comments on the reader's food or post do.
 */
export const useNewsBadge = () => {
  const { foodEntries, postEntries, milestoneEntries, commentEntries } = useNewsContext()
  const seenState = useNewsSeen()
  const { data: latestNote, refresh } = useFetch<{ at: number; revision: number }>(
    '/api/changelog/latest',
    {
      key: 'changelog-latest',
      server: false,
      dedupe: 'defer',
      default: () => ({ at: 0, revision: 0 })
    }
  )
  const route = useRoute()
  watch(
    () => route.path,
    () => refresh()
  )

  const hasUnread = computed(() => {
    const newestNoteAt = latestNote.value.at
    const newestNote = {
      key: 'latest-note',
      createdAt: newestNoteAt,
      revision: latestNote.value.revision
    }

    // Wait for browser storage to avoid a hydration mismatch.
    if (!seenState.ready.value) return false
    const seen = {
      lastReadAt: seenState.lastReadAt.value,
      lastSeenRevision: seenState.lastSeenRevision.value
    }

    return (
      (newestNoteAt > 0 && isUnread(newestNote, seen)) ||
      [
        ...foodEntries.value,
        ...postEntries.value,
        ...milestoneEntries.value,
        ...commentEntries.value
      ].some((entry) => isUnread(entry, seen))
    )
  })

  return { hasUnread }
}
