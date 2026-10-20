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
import { useStore } from '../../stores/index'
import { languageCreatedAtKey, languageBounds } from '#shared/utils/community-post'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The posts of one diary day in the reader's language, loaded for that day
 * only. Today reaches back 24 hours, so last evening is still there in the
 * morning.
 */
export const useDayPosts = (date: Ref<string>, isToday: Ref<boolean>) => {
  const store = useStore()
  const { locale } = useI18n()
  const posts = ref<Record<string, unknown>[]>([])
  let unsubscribe: (() => void) | null = null

  const bind = () => {
    unsubscribe?.()
    unsubscribe = null
    posts.value = []
    if (!import.meta.client || !store.user) return
    const language = locale.value
    const dayStart = new Date(`${date.value}T00:00:00`).getTime()
    if (!Number.isFinite(dayStart)) return
    // Rounded to the hour, so the window does not rebind every minute.
    const from = isToday.value
      ? Math.floor((Date.now() - DAY_MS) / (60 * 60 * 1000)) * 60 * 60 * 1000
      : dayStart
    const to = isToday.value ? null : dayStart + DAY_MS
    unsubscribe = onValue(
      query(
        databaseRef(getDatabase(), 'communityPosts'),
        orderByChild('languageCreatedAt'),
        startAt(languageCreatedAtKey(language, from)),
        endAt(to === null ? languageBounds(language).end : languageCreatedAtKey(language, to))
      ),
      (snapshot) => {
        const data = snapshot.val()
        posts.value =
          data && typeof data === 'object'
            ? Object.entries(data).map(([key, value]) => ({
                ...(value as Record<string, unknown>),
                '.key': key
              }))
            : []
      }
    )
  }

  watch([date, isToday, locale, () => (store.user as { id?: string } | null)?.id], bind, {
    immediate: true
  })
  onUnmounted(() => unsubscribe?.())

  return posts
}
