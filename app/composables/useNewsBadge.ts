import { useNewsContext } from './useNewsContext'
import { isUnread } from '../utils/news-grouping'

/**
 * Whether the bell shows a dot — for the header, on every page.
 *
 * The changelog reduces to its newest publication date and revision at build
 * time rather than being imported here, so a file that only grows is not
 * shipped to someone looking at their diary.
 *
 * A notice counts even though it has no timestamp: it is the one thing on this
 * page nothing else in the app would ever tell the contributor, so it would be
 * pointless to raise it somewhere they have no reason to look. It stays lit
 * while the food is still questioned, because unlike an entry it is not
 * something to read — it is something to deal with, and it clears itself when
 * the values are corrected or the votes recover.
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

    // Storage is loaded after mount so the server and first browser render
    // agree. The same browser marker works whether or not an account is signed
    // in; community foods simply join the calculation once auth restores them.
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
