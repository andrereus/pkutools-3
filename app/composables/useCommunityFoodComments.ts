import { getDatabase, onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database'
import { FOOD_CONTENT_FIELDS, type FoodContentField } from '#shared/utils/food-content'
import type { CommunityFoodThreadEntry } from './useApi'

const isTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

// Keep known fields once each. An older client can still show a general edit
// notice if a later version adds a field it does not recognize.
const normalizeChangedFields = (value: unknown): FoodContentField[] =>
  Array.isArray(value) ? FOOD_CONTENT_FIELDS.filter((field) => value.includes(field)) : []

/** Keep malformed legacy/database values away from rendering. */
export const normalizeCommunityFoodComments = (value: unknown): CommunityFoodThreadEntry[] => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value as Record<string, unknown>)
    .flatMap<CommunityFoodThreadEntry>(([key, raw]) => {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return []
      const comment = raw as Record<string, unknown>
      if (!isTimestamp(comment.createdAt)) return []
      if (comment.type === 'content-update') {
        return [
          {
            '.key': key,
            type: 'content-update',
            changedFields: normalizeChangedFields(comment.changedFields),
            createdAt: comment.createdAt
          }
        ]
      }
      if (
        (comment.type !== undefined && comment.type !== 'comment') ||
        typeof comment.authorId !== 'string' ||
        comment.authorId.trim() === '' ||
        typeof comment.text !== 'string' ||
        comment.text.trim() === '' ||
        comment.text.length > 300
      ) {
        return []
      }

      return [
        {
          '.key': key,
          type: 'comment',
          authorId: comment.authorId,
          text: comment.text,
          createdAt: comment.createdAt,
          updatedAt: isTimestamp(comment.updatedAt) ? comment.updatedAt : comment.createdAt
        }
      ]
    })
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt ||
        (left['.key'] < right['.key'] ? -1 : left['.key'] > right['.key'] ? 1 : 0)
    )
}

/**
 * Realtime comments for one food. The caller explicitly starts the listener,
 * allowing a collapsed News card to cost no additional database read.
 */
export const useCommunityFoodComments = (communityFoodKey: string) => {
  const comments = ref<CommunityFoodThreadEntry[]>([])
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
