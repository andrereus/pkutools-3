import changelog from '../../content/changelog.json'
import { useNewsContext, type NewsEntry } from './useNewsContext'

// The whole of News: the changelog from a file in the repository, merged with
// everything the store already holds.
//
// Three sources, none of them new:
//
//   - the changelog. Release notes ship in the commit that made the change, are
//     server-rendered into the page, and need no database, no cache and no
//     publishing screen.
//   - community foods, the node the app already loads in full for food search.
//     A food shared at a moment *is* the event; a separate item saying so would
//     be a third copy of the same record, and one that goes stale when the food
//     is edited or withdrawn.
//   - the reader's own diary, read for the days on which a logging streak
//     reached something worth marking.
//
// Deriving rather than storing buys something a written item could not: an entry
// disappears exactly when the thing it describes does.
//
// Only the news page imports this. The header uses useNewsBadge, which reaches
// the same store data without pulling the changelog into every page.

interface ChangelogText {
  title: string
  body: string
}

export interface ChangelogEntry {
  /** Stable identity and monotonic publication order. */
  revision: number
  /** Publication instant used for display and chronological ordering. */
  publishedAt: string
  category: 'new' | 'improved' | 'tip'
  en: ChangelogText
  de?: ChangelogText
  es?: ChangelogText
  fr?: ChangelogText
}

const entries = changelog as ChangelogEntry[]

/** The whole page, changelog included. Only the news page pays for this. */
export const useNews = () => {
  const { locale, foodEntries, milestoneEntries, notices, userIsAuthenticated } = useNewsContext()

  const noteEntries = computed<NewsEntry[]>(() =>
    entries.map((entry) => {
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
    [...noteEntries.value, ...foodEntries.value, ...milestoneEntries.value].sort(
      (left, right) => right.createdAt - left.createdAt
    )
  )

  return { items, notices, userIsAuthenticated }
}
