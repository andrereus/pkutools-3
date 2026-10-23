// The release notes, asked from the server each time a page that shows them
// opens, so an app that stays open across a deploy still gets new ones. They
// stay for the whole visit and are refreshed in the background, so a page
// shows them at once instead of a moment after the rest. The browser
// revalidates with the server and downloads only after a change.

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

let pending: Promise<ChangelogEntry[]> | null = null

/** `server` renders them into the page, for News; the diary loads them after. */
export const useChangelogNotes = ({ server = false } = {}) => {
  const notes = useState<ChangelogEntry[]>('changelog-notes', () => [])
  const loaded = useState('changelog-notes-loaded', () => false)

  const load = async () => {
    // One request at a time in the browser; each server render asks its own.
    const request = import.meta.client
      ? (pending ??= $fetch<ChangelogEntry[]>('/api/changelog'))
      : $fetch<ChangelogEntry[]>('/api/changelog')
    try {
      notes.value = await request
    } catch {
      // The last notes stay; the next page that shows them asks again.
    } finally {
      loaded.value = true
      if (import.meta.client) pending = null
    }
  }

  if (import.meta.server && server) onServerPrefetch(load)
  if (import.meta.client) onMounted(load)

  return { notes, loaded }
}
