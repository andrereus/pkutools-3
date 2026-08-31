import { isNewsTimestamp } from '../utils/news-grouping'

// The two positions covered by the last visit. Both are browser-local because
// they control only presentation: time covers chronological events; revision
// catches a release note that was deployed behind that time.

const READ_AT_KEY = 'news_last_read_at'
const REVISION_KEY = 'news_last_seen_revision'

export const parseNewsSeenMarker = (value: unknown): number | null => {
  const marker = Number(value)
  return isNewsTimestamp(marker) ? marker : null
}

export const useNewsSeen = () => {
  const ready = useState('news-seen-ready', () => false)
  const lastReadAt = useState<number | null>('news-seen-last-read-at', () => null)
  const lastSeenRevision = useState<number | null>('news-seen-last-seen-revision', () => null)

  const load = () => {
    if (!import.meta.client || ready.value) return
    try {
      lastReadAt.value = parseNewsSeenMarker(localStorage.getItem(READ_AT_KEY))
      lastSeenRevision.value = parseNewsSeenMarker(localStorage.getItem(REVISION_KEY))
    } catch {
      // Locked-down browsers can reject storage. The in-memory state still
      // keeps the badge and page consistent for the current visit.
    }
    ready.value = true
  }

  const markReadAt = (value: number) => {
    const marker = parseNewsSeenMarker(value)
    if (marker === null || marker <= (lastReadAt.value ?? 0)) return

    lastReadAt.value = marker
    try {
      if (import.meta.client) localStorage.setItem(READ_AT_KEY, String(marker))
    } catch {
      // Persistence is optional; the reactive marker was still advanced.
    }
  }

  const markRevision = (value: number) => {
    const marker = parseNewsSeenMarker(value)
    if (marker === null || marker <= (lastSeenRevision.value ?? 0)) return

    lastSeenRevision.value = marker
    try {
      if (import.meta.client) localStorage.setItem(REVISION_KEY, String(marker))
    } catch {
      // Persistence is optional; the reactive marker was still advanced.
    }
  }

  onMounted(load)

  return { ready, lastReadAt, lastSeenRevision, markReadAt, markRevision }
}
