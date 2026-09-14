import { useStore } from '../../stores/index'

type AppSettings = {
  maxPhe: number | null
  maxKcal: number | null
  bloodPheMin: number | null
  bloodPheMax: number | null
  bloodTyrMin: number | null
  bloodTyrMax: number | null
  labUnit: 'mgdl' | 'umoll'
  license: string | null
}

type Customization = {
  progressStyle: 'bars' | 'circles'
  preferredTool: 'food-search' | 'barcode-scanner' | 'ai-calculator' | 'phe-calculator'
}

const appSettingsFields = [
  'maxPhe',
  'maxKcal',
  'bloodPheMin',
  'bloodPheMax',
  'bloodTyrMin',
  'bloodTyrMax',
  'labUnit',
  'license'
] as const

export const useSettingsForm = () => {
  const store = useStore()
  // The store is plain JavaScript, so TypeScript would infer the user as null.
  const user = () => store.user as { id: string } | null
  const { updateSettings } = useApi()
  const notifications = useNotifications()
  const { t } = useI18n()
  const appSettings = reactive(
    Object.fromEntries(appSettingsFields.map((key) => [key, store.settings[key]])) as AppSettings
  )
  const savingAppSettings = ref(false)
  const customizationFailed = ref(false)
  const pending = shallowRef<{ userId: string; changes: Partial<Customization> } | null>(null)

  // Firebase replaces the settings object after every write. Refresh untouched
  // inputs, but preserve unfinished edits when a customization is saved.
  watch(
    [() => user()?.id, () => store.settings],
    ([userId, current], [previousUserId, previous]) => {
      for (const key of appSettingsFields) {
        if (userId !== previousUserId || appSettings[key] === previous[key]) {
          Object.assign(appSettings, { [key]: current[key] })
        }
      }
      if (userId !== previousUserId) {
        pending.value = null
        customizationFailed.value = false
      }
    },
    { flush: 'sync' }
  )

  const customization = computed(() => ({
    progressStyle: store.settings.progressStyle as Customization['progressStyle'],
    preferredTool: store.settings.preferredTool as Customization['preferredTool'],
    ...pending.value?.changes
  }))
  const savingCustomization = computed(() => pending.value !== null)

  const saveCustomization = async <K extends keyof Customization>(
    key: K,
    value: Customization[K]
  ) => {
    if (!user() || !store.settingsLoaded || pending.value) return
    if (value === store.settings[key]) return

    const request = { userId: user()!.id, changes: { [key]: value } }
    pending.value = request
    customizationFailed.value = false
    try {
      // Only the selected preference is sent; unfinished form fields stay local.
      await updateSettings(request.changes)
      if (pending.value === request && user()?.id === request.userId) {
        Object.assign(store.settings, request.changes)
      }
    } catch {
      // useApi reports the error. Clearing the pending choice restores the last
      // confirmed value, so a failed save never appears to have succeeded.
      if (pending.value === request) customizationFailed.value = true
    } finally {
      if (pending.value === request) pending.value = null
    }
  }

  const save = async () => {
    if (savingAppSettings.value) return
    if (!user() || store.settings.healthDataConsent !== true) {
      notifications.error(t('health-consent.no-consent'))
      return
    }

    const userId = user()!.id
    savingAppSettings.value = true
    try {
      await updateSettings({
        maxPhe: appSettings.maxPhe || null,
        maxKcal: appSettings.maxKcal || null,
        bloodPheMin: appSettings.bloodPheMin || null,
        bloodPheMax: appSettings.bloodPheMax || null,
        bloodTyrMin: appSettings.bloodTyrMin || null,
        bloodTyrMax: appSettings.bloodTyrMax || null,
        labUnit: appSettings.labUnit
      })
      if (user()?.id === userId) notifications.success(t('settings.saved'))
    } catch {
      // useApi reports the error; keep the draft available for another attempt.
    } finally {
      savingAppSettings.value = false
    }
  }

  return {
    appSettings,
    save,
    savingAppSettings,
    customization,
    saveCustomization,
    savingCustomization,
    customizationFailed
  }
}
