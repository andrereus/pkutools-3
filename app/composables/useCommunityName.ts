import { useStore } from '../../stores/index'

/** The reader's own opt-in community name, edited in News and in Settings. */
export const useCommunityName = () => {
  const store = useStore()
  const { t } = useI18n()
  const notifications = useNotifications()
  const { saveCommunityName } = useApi()

  const current = computed<string | null>(() => {
    const user = store.user as { id?: string } | null
    const names = store.communityNames as Record<string, string>
    return user?.id ? (names[user.id] ?? null) : null
  })
  const saving = ref(false)

  /** Saves the trimmed name, or removes it when empty. Returns whether it is stored. */
  const save = async (draft: string): Promise<boolean> => {
    const name = draft.trim() || null
    if (name === current.value) return true
    if (name !== null && name.length < 2) {
      notifications.error(t('community.name-too-short'))
      return false
    }
    saving.value = true
    try {
      await saveCommunityName(name)
      notifications.success(t(name ? 'community.name-saved' : 'community.name-removed'))
      return true
    } catch {
      // useApi already reports the translated error.
      return false
    } finally {
      saving.value = false
    }
  }

  return { current, saving, save }
}
