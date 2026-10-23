import { useNewsContext, type NewsEntry } from './useNewsContext'
import { useChangelogNotes } from './useChangelogNotes'
import { newsEntryTimestamp } from '../utils/news-grouping'

// Merges the release notes with community and diary-derived entries.

/** The whole page, release notes included. */
export const useNews = () => {
  const {
    locale,
    foodEntries,
    postEntries,
    milestoneEntries,
    notices,
    postNotices,
    threadNotices,
    commentEntries,
    showHiddenFoods,
    hasHiddenFoods,
    userIsAuthenticated
  } = useNewsContext()
  const notes = useChangelogNotes({ server: true })

  const noteEntries = computed<NewsEntry[]>(() =>
    notes.value.map((entry) => {
      // English is the only language a note must have. The rest fall back to it,
      // so one can be translated months later without holding up a release.
      const text = entry[locale.value as 'de' | 'es' | 'fr'] ?? entry.en
      return {
        key: `note-${entry.revision}`,
        kind: 'note' as const,
        // The instant fixes the note's chronological position. Revision keeps
        // a late-deployed note unread even if that position is behind the time
        // covered by the reader's previous visit.
        createdAt: new Date(entry.publishedAt).getTime(),
        revision: entry.revision,
        category: entry.category,
        title: text.title,
        body: text.body
      }
    })
  )

  /** Everything this reader can see, newest first. */
  const items = computed<NewsEntry[]>(() =>
    [
      ...noteEntries.value,
      ...foodEntries.value,
      ...postEntries.value,
      ...milestoneEntries.value
    ].sort((left, right) => newsEntryTimestamp(right) - newsEntryTimestamp(left))
  )

  return {
    items,
    notices,
    postNotices,
    threadNotices,
    commentEntries,
    showHiddenFoods,
    hasHiddenFoods,
    userIsAuthenticated
  }
}
