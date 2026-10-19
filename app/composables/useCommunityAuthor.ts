import { useStore } from '../../stores/index'

/**
 * Who wrote a post or comment, as readers see it: PKU Tools for an admin
 * account, "You", the author's opt-in community name, their role on the
 * thread, or "Community member". Admin status is looked up, not stored on the
 * content, so the label follows the account's current rights.
 */
export const useCommunityAuthor = () => {
  const store = useStore()
  const { t } = useI18n()

  const nameOf = (authorId: unknown): string | null => {
    const names = store.communityNames as Record<string, string>
    return typeof authorId === 'string' ? (names[authorId] ?? null) : null
  }

  const isOfficial = (authorId: unknown): boolean =>
    typeof authorId === 'string' && (store.adminIds as Record<string, boolean>)[authorId] === true

  const authorLabel = (authorId: unknown, currentUserId: string | null, role?: string | null) => {
    if (isOfficial(authorId)) return 'PKU Tools'
    if (typeof authorId === 'string' && authorId === currentUserId) {
      return t('news.comment-author-you')
    }
    const name = nameOf(authorId)
    if (name) return role ? `${name} · ${role}` : name
    return role ?? t('news.comment-author-community')
  }

  return { nameOf, isOfficial, authorLabel }
}
