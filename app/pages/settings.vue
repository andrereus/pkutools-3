<script setup>
import { format, parseISO } from 'date-fns'
import { enUS, de, fr, es } from 'date-fns/locale'
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()
const i18nLocale = useI18n().locale
const notifications = useNotifications()
const confirm = useConfirm()
const {
  updateSettings,
  resetData,
  deleteAccount: deleteAccountApi,
  updateConsent,
  updateGettingStarted
} = useApi()

// Date formatting function
const formatConsentDate = (dateString) => {
  if (dateString) {
    const locales = { enUS, de, fr, es }
    return format(parseISO(dateString), 'PPP', { locale: locales[i18nLocale.value] })
  }
  return ''
}

// Reactive state
const selectedTheme = ref('system')

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const settings = computed(() => store.settings)

const themeOptions = computed(() => [
  { title: t('settings.theme-system'), value: 'system' },
  { title: t('settings.theme-light'), value: 'light' },
  { title: t('settings.theme-dark'), value: 'dark' }
])

const unitOptions = computed(() => [
  { title: 'mg/dL', value: 'mgdl' },
  { title: 'µmol/L', value: 'umoll' }
])

// Methods
const { handleError } = useErrorHandler()

const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    handleError(error, 'sign in')
  }
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  try {
    await updateSettings({
      maxPhe: settings.value.maxPhe || 0,
      maxKcal: settings.value.maxKcal || 0,
      labUnit: settings.value.labUnit
    })
    notifications.success(t('settings.saved'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save settings error:', error)
  }
}

const saveLicense = async () => {
  try {
    // First validate the license via server API
    const { validateLicense, clearCache } = useLicense()

    // Clear cache before validating to ensure fresh validation
    clearCache()

    const validation = await validateLicense(settings.value.license || '')

    // Then save to Firebase via server API
    await updateSettings({
      license: settings.value.license || ''
    })

    if (validation.valid) {
      // Determine which plan is active
      const planName = validation.premiumAI
        ? t('settings.tier-premium-ai')
        : t('settings.tier-unlimited')
      notifications.success(t('settings.license-active') + ' ' + planName + ' 🎉')
    } else {
      notifications.info(t('settings.license-inactive'))
      // Clear cache for invalid licenses to ensure UI reflects invalid state
      clearCache()
    }
  } catch (error) {
    // Error handling is done in useLicense composable
    console.error('License save error:', error)
    // Clear cache on error to ensure UI doesn't show stale premium status
    const { clearCache } = useLicense()
    clearCache()
  }
}

const resetDiary = async () => {
  const r = await confirm.confirm({
    title: t('settings.reset-diary'),
    message: t('settings.reset-diary-description'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel')
  })
  if (r === true) {
    try {
      await resetData('diary')
      navigateTo(localePath('diary'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Reset diary error:', error)
    }
  }
}

const resetLabValues = async () => {
  const r = await confirm.confirm({
    title: t('settings.reset-blood-values'),
    message: t('settings.reset-blood-values-description'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel')
  })
  if (r === true) {
    try {
      await resetData('labValues')
      navigateTo(localePath('blood-values'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Reset lab values error:', error)
    }
  }
}

const resetOwnFood = async () => {
  const r = await confirm.confirm({
    title: t('settings.reset-own-food'),
    message: t('settings.reset-own-food-description'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel')
  })
  if (r === true) {
    try {
      await resetData('ownFood')
      navigateTo(localePath('own-food'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Reset own food error:', error)
    }
  }
}

const handleDeleteAccount = async () => {
  const r = await confirm.confirm({
    title: t('settings.delete-account'),
    message: t('settings.delete-account-description'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel')
  })
  if (r === true) {
    try {
      await deleteAccountApi()
      await store.signOut()
      // Navigate to index after sign out completes to show the home page
      await navigateTo(localePath('index'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Delete account error:', error)
      notifications.error(t('settings.delete-account-error'))
    }
  }
}

const giveHealthDataConsent = async () => {
  try {
    await updateConsent({ healthDataConsent: true })
    notifications.success(t('health-consent.consent-given'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Update consent error:', error)
    notifications.error(t('health-consent.error-saving'))
  }
}

const revokeHealthDataConsent = async () => {
  const r = await confirm.confirm({
    title: t('health-consent.revoke'),
    message: t('health-consent.revoke-confirm'),
    confirmLabel: t('health-consent.revoke'),
    cancelLabel: t('common.cancel')
  })
  if (r === true) {
    try {
      await updateConsent({ healthDataConsent: false })
      notifications.success(t('health-consent.consent-revoked'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Update consent error:', error)
      notifications.error(t('health-consent.error-revoking'))
    }
  }
}

const updateEmailConsent = async (emailConsent) => {
  try {
    await updateConsent({ emailConsent })
    notifications.success(t('health-consent.email-consent-updated'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Update consent error:', error)
    notifications.error(t('health-consent.error-updating-email'))
  }
}

const reopenOnboarding = async () => {
  try {
    await updateGettingStarted(false)
    navigateTo(localePath('getting-started'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Update getting started error:', error)
    notifications.error(t('health-consent.error-saving'))
  }
}

const handleThemeChange = () => {
  if (selectedTheme.value === 'light') {
    localStorage.setItem('theme', 'light')
    document.documentElement.classList.remove('dark')
  } else if (selectedTheme.value === 'dark') {
    localStorage.setItem('theme', 'dark')
    document.documentElement.classList.add('dark')
  } else {
    localStorage.removeItem('theme')
    if (window.matchMedia('(prefers-color-scheme: dark)').matches === true) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
}

// Lifecycle hooks
onMounted(() => {
  selectedTheme.value = localStorage.getItem('theme') || 'system'
})

definePageMeta({
  i18n: {
    paths: {
      en: '/settings',
      de: '/einstellungen',
      es: '/configuracion',
      fr: '/parametres'
    }
  }
})

useSeoMeta({
  title: () => t('settings.title')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('settings.title') + ' - PKU Tools',
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('settings.title')" />
    </header>

    <div v-if="!userIsAuthenticated">
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
        <br />
        <NuxtLink
          type="button"
          :to="$localePath('sign-in')"
          class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 mr-3 mb-6"
        >
          {{ $t('sign-in.signin-with-email') }}
        </NuxtLink>
      </div>
    </div>

    <div v-if="userIsAuthenticated">
      <!-- Getting Started Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('getting-started.title')" class="mb-4" />
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('getting-started.subtitle') }}
        </p>
        <SecondaryButton :text="$t('health-consent.reopen-onboarding')" @click="reopenOnboarding" />
      </div>

      <!-- Health Data Consent Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('health-consent.title')" class="mb-4" />
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('health-consent.subtitle') }}
        </p>
        <div
          v-if="store.settings.healthDataConsent === true"
          class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20 mb-4"
        >
          <div class="flex items-center">
            <LucideCheckCircle class="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <span class="text-sm font-medium text-green-800 dark:text-green-200">
              {{ $t('health-consent.consent-given') }}
            </span>
          </div>
          <p class="mt-2 text-xs text-green-700 dark:text-green-300">
            {{ $t('health-consent.consent-date') }}:
            {{ formatConsentDate(settings.healthDataConsentDate) }}
          </p>
        </div>
        <div v-else class="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20 mb-4">
          <div class="flex items-center">
            <LucideAlertTriangle class="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <span class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {{ $t('health-consent.no-consent-status') }}
            </span>
          </div>
          <p class="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
            {{ $t('health-consent.no-consent-explanation') }}
          </p>
        </div>
        <div class="flex space-x-3">
          <PrimaryButton
            v-if="store.settings.healthDataConsent !== true"
            :text="$t('health-consent.accept')"
            @click="giveHealthDataConsent"
          />
          <SecondaryButton
            v-if="store.settings.healthDataConsent === true"
            :text="$t('health-consent.revoke')"
            @click="revokeHealthDataConsent"
          />
        </div>
      </div>

      <!-- Email Notifications Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('health-consent.email-consent-title')" class="mb-4" />
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('health-consent.email-consent-subtitle') }}
        </p>
        <div
          v-if="settings.emailConsent"
          class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20 mb-4"
        >
          <div class="flex items-center">
            <LucideCheckCircle class="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <span class="text-sm font-medium text-green-800 dark:text-green-200">
              {{ $t('health-consent.email-consent-given') }}
            </span>
          </div>
          <p class="mt-2 text-xs text-green-700 dark:text-green-300">
            {{ $t('health-consent.email-consent-date') }}:
            {{ formatConsentDate(settings.emailConsentDate) }}
          </p>
        </div>
        <div v-else class="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/20 mb-4">
          <div class="flex items-center">
            <LucideMail class="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
            <span class="text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ $t('health-consent.email-consent-not-given') }}
            </span>
          </div>
        </div>
        <div class="flex space-x-3">
          <PrimaryButton
            v-if="!settings.emailConsent"
            :text="$t('health-consent.email-consent-accept')"
            @click="updateEmailConsent(true)"
          />
          <SecondaryButton
            v-if="settings.emailConsent"
            :text="$t('health-consent.email-consent-revoke')"
            @click="updateEmailConsent(false)"
          />
        </div>
      </div>

      <!-- App Settings Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('settings.app-settings')" class="mb-4" />
        <NumberInput
          v-model.number="settings.maxPhe"
          id-name="max-phe"
          :label="$t('settings.max-phe')"
          class="mb-4"
        />

        <NumberInput
          v-model.number="settings.maxKcal"
          id-name="max-kcal"
          :label="$t('settings.max-kcal')"
          class="mb-4"
        />

        <SelectMenu
          v-model="settings.labUnit"
          id-name="unit"
          :label="$t('blood-values.unit')"
          class="mb-4"
        >
          <option v-for="option in unitOptions" :key="option.value" :value="option.value">
            {{ option.title }}
          </option>
        </SelectMenu>

        <SelectMenu
          v-model="selectedTheme"
          id-name="theme-select"
          :label="$t('settings.theme')"
          class="mb-6"
          @change="handleThemeChange"
        >
          <option v-for="option in themeOptions" :key="option.value" :value="option.value">
            {{ option.title }}
          </option>
        </SelectMenu>

        <PrimaryButton :text="$t('common.save')" @click="save" />
      </div>

      <!-- Premium & License Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader title="PKU Tools Premium" class="mb-4" />
        <TiersCard align="left" class="mb-6" />

        <PageHeader :title="$t('settings.license-heading')" class="mb-4" />
        <TextInput
          v-model="settings.license"
          id-name="license"
          :label="$t('settings.license-key')"
          class="mb-6"
        />
        <PrimaryButton :text="$t('settings.check-license')" @click="saveLicense" />
      </div>

      <!-- Account Management Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('settings.change-password')" class="mb-4" />
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('settings.change-password-info') }}
        </p>
      </div>

      <!-- Data Management Section -->
      <div
        class="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('settings.reset-heading')" class="mb-4" />
        <div class="space-y-3">
          <SecondaryButton :text="$t('settings.reset-diary')" @click="resetDiary" />
          <SecondaryButton :text="$t('settings.reset-blood-values')" @click="resetLabValues" />
          <SecondaryButton :text="$t('settings.reset-own-food')" @click="resetOwnFood" />
        </div>
      </div>

      <!-- Account Deletion Section -->
      <div
        class="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 shadow-sm border border-red-200 dark:border-red-800 mb-8"
      >
        <PageHeader :title="$t('settings.delete-account')" class="mb-4" />
        <p class="mb-4 text-sm text-red-700 dark:text-red-300">
          {{ $t('settings.delete-account-info') }}
        </p>
        <SecondaryButton :text="$t('settings.delete-account')" @click="handleDeleteAccount" />
      </div>
    </div>
  </div>
</template>
