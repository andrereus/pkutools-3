import { getDatabase, onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database'
import type { CommunityFoodComment } from './useApi'

const isTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** Keep malformed legacy/database values away from rendering. */
export const normalizeCommunityFoodComments = (value: unknown): CommunityFoodComment[] => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, raw]) => {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return []
      const comment = raw as Record<string, unknown>
      if (
        typeof comment.authorId !== 'string' ||
        comment.authorId.trim() === '' ||
        typeof comment.text !== 'string' ||
        comment.text.trim() === '' ||
        comment.text.length > 300 ||
        !isTimestamp(comment.createdAt)
      ) {
        return []
      }

      return [
        {
          '.key': key,
          authorId: comment.authorId,
          text: comment.text,
          createdAt: comment.createdAt,
          updatedAt: isTimestamp(comment.updatedAt) ? comment.updatedAt : comment.createdAt
        }
      ]
    })
    .sort((left, right) => left.createdAt - right.createdAt)
}

/**
 * Realtime comments for one food. The caller explicitly starts the listener,
 * allowing a collapsed News card to cost no additional database read.
 */
export const useCommunityFoodComments = (communityFoodKey: string) => {
  const comments = ref<CommunityFoodComment[]>([])
  const loading = ref(false)
  const loadFailed = ref(false)
  let unsubscribe: Unsubscribe | null = null

  const stop = () => {
    unsubscribe?.()
    unsubscribe = null
  }

  const start = () => {
    if (!import.meta.client || unsubscribe) return
    loading.value = true
    loadFailed.value = false
    unsubscribe = onValue(
      databaseRef(getDatabase(), `communityFoodComments/${communityFoodKey}`),
      (snapshot) => {
        comments.value = normalizeCommunityFoodComments(snapshot.val())
        loading.value = false
      },
      () => {
        loadFailed.value = true
        loading.value = false
      }
    )
  }

  onUnmounted(stop)

  return { comments, loading, loadFailed, start, stop }
}
