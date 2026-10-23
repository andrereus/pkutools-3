import {
  getDatabase,
  onValue,
  query,
  ref as databaseRef,
  orderByChild,
  startAt,
  endAt
} from 'firebase/database'
import type { Ref } from 'vue'
import { toList, useStore } from '../../stores/index'
import { languageCreatedAtKey, languageBounds } from '#shared/utils/community-post'

const DAY_MS = 24 * 60 * 60 * 1000

// The posts of each day already shown in this visit, so going back to a day
// shows them at once while the listener catches up.
const seenDays = new Map<string, Record<string, unknown>[]>()

/**
 * The posts of one diary day in the reader's language, loaded for that day
 * only. Today reaches back 24 hours, so last evening is still there in the
 * morning. `loaded` is false until the day's posts are known.
 */
export const useDayPosts = (date: Ref<string>, isToday: Ref<boolean>) => {
  const store = useStore()
  const { locale } = useI18n()
  const posts = ref<Record<string, unknown>[]>([])
  const loaded = ref(false)
  let unsubscribe: (() => void) | null = null

  const bind = () => {
    unsubscribe?.()
    unsubscribe = null
    if (!import.meta.client || !store.user) {
      posts.value = []
      loaded.value = true
      return
    }
    const language = locale.value
    const dayKey = `${language}:${isToday.value ? 'today' : date.value}`
    posts.value = seenDays.get(dayKey) ?? []
    loaded.value = seenDays.has(dayKey)
    const [year, month, day] = date.value.split('-').map(Number)
    if (!year || !month || !day) {
      loaded.value = true
      return
    }
    // Calendar days, so the day the clocks change keeps all its hours.
    const dayStart = new Date(year, month - 1, day).getTime()
    const nextDayStart = new Date(year, month - 1, day + 1).getTime()
    // Rounded to the hour, so the window does not rebind every minute.
    const from = isToday.value
      ? Math.floor((Date.now() - DAY_MS) / (60 * 60 * 1000)) * 60 * 60 * 1000
      : dayStart
    const to = isToday.value ? null : nextDayStart - 1
    unsubscribe = onValue(
      query(
        databaseRef(getDatabase(), 'communityPosts'),
        orderByChild('languageCreatedAt'),
        startAt(languageCreatedAtKey(language, from)),
        endAt(to === null ? languageBounds(language).end : languageCreatedAtKey(language, to))
      ),
      (snapshot) => {
        posts.value = toList(snapshot.val())
        seenDays.set(dayKey, posts.value)
        loaded.value = true
      },
      () => {
        // Refused: the rest of the day shows without its posts.
        loaded.value = true
      }
    )
  }

  watch([date, isToday, locale, () => (store.user as { id?: string } | null)?.id], bind, {
    immediate: true
  })
  onUnmounted(() => unsubscribe?.())

  return { posts, loaded }
}
