import changelog from '../../content/changelog.json'
import { useNewsContext, type NewsEntry } from './useNewsContext'

// Merges the authored changelog with community-food and diary-derived entries.
// Only the News page imports this module, keeping changelog content out of the
// global layout bundle.

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
