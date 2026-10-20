import { useStore } from '../../stores/index'

/**
 * Marks a thread as read once the reader opens it, if it is their own food or
 * post or one they commented on. That settles the notification about it on
 * every device. Asks the server only when a comment by someone else is newer
 * than the last read.
 */
export const useCommentsRead = (target: 'food' | 'post', key: string) => {
  const store = useStore()
  const { markCommunityCommentsRead } = useApi()
  let requestedFor = 0

  // The last opening, or for a commenter their own last comment there.
  const readAt = () => {
    const stamp = (source: unknown) => {
      const value = (source as Record<string, Record<string, unknown>>)?.[`${target}s`]?.[key]
      return typeof value === 'number' ? value : 0
    }
    return Math.max(stamp(store.communityReads), stamp(store.communityThreads))
  }

  const markRead = (
    comments: readonly { type?: string; authorId?: string; createdAt: number }[],
    readerId: string
  ) => {
    const latest = Math.max(
      0,
      ...comments
        .filter((comment) => comment.type !== 'content-update' && comment.authorId !== readerId)
        .map((comment) => comment.createdAt)
    )
    if (latest === 0 || latest <= readAt() || latest <= requestedFor) return
    requestedFor = latest
    markCommunityCommentsRead({ target, key }).catch(() => {
      // Silent: the notification stays and the next opening tries again.
      requestedFor = 0
    })
  }

  return { markRead }
}
