import { useStore } from '../../stores/index'
import { isNewsTimestamp } from '../utils/news-grouping'

// The two positions covered by the last News visit: time covers chronological
// events; revision catches a release note that was deployed behind that time.
// Signed in, the account's positions decide, so every device shows the same
// blue dots and bell. The browser keeps its own for signed-out visits, and
// they stand in until an account has visited News once.

const READ_AT_KEY = 'news_last_read_at'
const REVISION_KEY = 'news_last_seen_revision'

type Field = 'lastReadAt' | 'lastSeenRevision'

export const parseNewsSeenMarker = (value: unknown): number | null => {
  const marker = Number(value)
  return isNewsTimestamp(marker) ? marker : null
}

// Positions sent to the server but not yet back through the listener, so a
// page that marks repeatedly does not send the same position twice.
const requested: { userId: string | null } & Record<Field, number> = {
  userId: null,
  lastReadAt: 0,
  lastSeenRevision: 0
}

export const useNewsSeen = () => {
  const store = useStore()
  const { markNewsSeen } = useApi()
  const localReady = useState('news-seen-ready', () => false)
  const localReadAt = useState<number | null>('news-seen-last-read-at', () => null)
  const localRevision = useState<number | null>('news-seen-last-seen-revision', () => null)

  // The store is plain JavaScript, so its fields are narrowed here.
  const userId = computed(() => (store.user as { id?: string } | null)?.id ?? null)
  const readState = computed(
    () => store.readState as { loaded: boolean; news: Record<Field, number | null> }
  )
  const account = computed(() => readState.value.news)

  // Signed in, the account's positions must have loaded too, so no dot flashes.
  const ready = computed(() => localReady.value && (!userId.value || readState.value.loaded))
  const lastReadAt = computed(() =>
    userId.value ? (account.value.lastReadAt ?? localReadAt.value) : localReadAt.value
  )
  const lastSeenRevision = computed(() =>
    userId.value ? (account.value.lastSeenRevision ?? localRevision.value) : localRevision.value
  )

  const load = () => {
    if (!import.meta.client || localReady.value) return
    try {
      localReadAt.value = parseNewsSeenMarker(localStorage.getItem(READ_AT_KEY))
      localRevision.value = parseNewsSeenMarker(localStorage.getItem(REVISION_KEY))
    } catch {
      // Locked-down browsers can reject storage. The in-memory state still
      // keeps the badge and page consistent for the current visit.
    }
    localReady.value = true
  }

  const persist = (key: string, marker: number) => {
    try {
      if (import.meta.client) localStorage.setItem(key, String(marker))
    } catch {
      // Persistence is optional; the reactive marker was still advanced.
    }
  }

  const sendToAccount = (field: Field, marker: number) => {
    if (!userId.value || !readState.value.loaded) return
    if (requested.userId !== userId.value) {
      Object.assign(requested, { userId: userId.value, lastReadAt: 0, lastSeenRevision: 0 })
    }
    if (marker <= Math.max(account.value[field] ?? 0, requested[field])) return
    requested[field] = marker
    markNewsSeen({ [field]: marker }).catch(() => {
      // The next visit sends it again.
      requested[field] = 0
    })
  }

  // The browser always advances too, so signing out does not bring back as
  // new what was already seen.
  const markReadAt = (value: number) => {
    const marker = parseNewsSeenMarker(value)
    if (marker === null) return
    if (marker > (localReadAt.value ?? 0)) {
      localReadAt.value = marker
      persist(READ_AT_KEY, marker)
    }
    sendToAccount('lastReadAt', marker)
  }

  const markRevision = (value: number) => {
    const marker = parseNewsSeenMarker(value)
    if (marker === null) return
    if (marker > (localRevision.value ?? 0)) {
      localRevision.value = marker
      persist(REVISION_KEY, marker)
    }
    sendToAccount('lastSeenRevision', marker)
  }

  onMounted(load)

  return { ready, lastReadAt, lastSeenRevision, markReadAt, markRevision }
}
