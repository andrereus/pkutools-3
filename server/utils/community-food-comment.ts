export const MAX_COMMUNITY_FOOD_COMMENTS = 100

/** Rebuild activity from surviving human comments, never from edit history. */
export function communityFoodCommentActivity(
  thread: Record<string, unknown>,
  contributorId: unknown,
  excludedCommentId: string
): { lastCommunityCommentAt: number | null; lastContributorCommentAt: number | null } {
  const activity = {
    lastCommunityCommentAt: null as number | null,
    lastContributorCommentAt: null as number | null
  }
  for (const [id, raw] of Object.entries(thread)) {
    if (id === excludedCommentId || !raw || typeof raw !== 'object') continue
    const comment = raw as Record<string, unknown>
    if (
      (comment.type !== undefined && comment.type !== 'comment') ||
      typeof comment.authorId !== 'string' ||
      !comment.authorId ||
      typeof comment.createdAt !== 'number' ||
      !Number.isSafeInteger(comment.createdAt) ||
      comment.createdAt <= 0
    )
      continue
    const field =
      comment.authorId === contributorId ? 'lastContributorCommentAt' : 'lastCommunityCommentAt'
    activity[field] = Math.max(activity[field] ?? 0, comment.createdAt)
  }
  return activity
}

/**
 * Adds the comment-side deletion for a community food to an existing atomic
 * root update. Comments and edit history disappear when the food is withdrawn
 * or deleted, while ordinary content edits preserve the whole thread.
 */
export function queueCommunityFoodCommentRemoval(
  communityFoodKey: string,
  writes: Record<string, unknown>
): void {
  writes[`communityFoodComments/${communityFoodKey}`] = null
}
