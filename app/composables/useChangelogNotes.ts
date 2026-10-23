// The release notes, asked from the server each time a page that shows them
// opens, so an app that stays open across a deploy still gets new ones. The
// browser revalidates with the server and downloads only after a change.

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

/**
 * `server` renders them into the page, for News; the diary loads them after.
 * The last notes are kept for the visit, so a page that opens again shows them
 * at once while the server is asked for new ones.
 */
export const useChangelogNotes = ({ server = false } = {}) => {
  const lastNotes = useState<ChangelogEntry[]>('changelog-notes', () => [])
  const { data } = useFetch<ChangelogEntry[]>('/api/changelog', {
    key: 'changelog',
    server,
    dedupe: 'defer',
    default: () => lastNotes.value
  })
  if (import.meta.client) {
    watch(data, (notes) => {
      if (notes.length > 0) lastNotes.value = notes
    })
  }
  return data
}
