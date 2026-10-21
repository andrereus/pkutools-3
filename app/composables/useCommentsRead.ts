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

  const entryOf = (source: unknown) =>
    (source as Record<string, Record<string, unknown>>)?.[`${target}s`]?.[key]
  const timeOf = (value: unknown) => (typeof value === 'number' ? value : 0)

  // The owner and those who joined the conversation, decided as the server
  // decides it: by the joined entry, not by the comments on screen.
  const markRead = (
    comments: readonly { type?: string; authorId?: string; createdAt: number }[],
    readerId: string,
    ownerId: string | null | undefined
  ) => {
    if (ownerId !== readerId && !entryOf(store.communityThreads)) return
    // The last opening, or the reader's own last comment there.
    const readAt = timeOf(entryOf(store.communityReads))
    const latest = Math.max(
      0,
      ...comments
        .filter((comment) => comment.type !== 'content-update' && comment.authorId !== readerId)
        .map((comment) => comment.createdAt)
    )
    if (latest === 0 || latest <= readAt || latest <= requestedFor) return
    requestedFor = latest
    markCommunityCommentsRead({ target, key }).catch(() => {
      // Silent: the notification stays and the next opening tries again.
      requestedFor = 0
    })
  }

  return { markRead }
}
