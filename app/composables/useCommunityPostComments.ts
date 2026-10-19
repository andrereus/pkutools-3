import { getDatabase, onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database'
import type { CommunityFoodComment } from './useApi'
import { normalizeCommunityFoodComments } from './useCommunityFoodComments'

/**
 * Realtime comments for one post. Post threads hold only comments, which have
 * the same shape as those on foods. The caller starts the listener, so a
 * collapsed card costs no database read.
 */
export const useCommunityPostComments = (postId: string) => {
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
      databaseRef(getDatabase(), `communityPostComments/${postId}`),
      (snapshot) => {
        comments.value = normalizeCommunityFoodComments(snapshot.val()).filter(
          (entry): entry is CommunityFoodComment => entry.type === 'comment'
        )
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
