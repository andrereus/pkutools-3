<script setup>
import { format, parseISO } from 'date-fns'
import { enUS, de, fr, es } from 'date-fns/locale'
import { getDatabase, ref as dbRef, remove, update } from 'firebase/database'
import { getAuth } from 'firebase/auth'
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const config = useRuntimeConfig()
const localePath = useLocalePath()
const i18nLocale = useI18n().locale

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
const user = computed(() => store.user)
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
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
    // Check if user has given health data consent
    if (store.settings.healthDataConsentDate) {
      navigateTo(localePath('diary'))
    } else {
      navigateTo(localePath('getting-started'))
    }
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

const save = () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    alert(t('health-consent.no-consent'))
    return
  }

  const db = getDatabase()
  update(dbRef(db, `${user.value.id}/settings`), {
    maxPhe: settings.value.maxPhe || 0,
    maxKcal: settings.value.maxKcal || 0,
    labUnit: settings.value.labUnit
  }).then(() => {
    alert(t('settings.saved'))
  })
}

const saveLicense = () => {
  const db = getDatabase()
  update(dbRef(db, `${user.value.id}/settings`), {
    license: settings.value.license || ''
  }).then(() => {
    if (settings.value.license === config.public.pkutoolsLicenseKey) {
      alert(t('settings.license-active') + ' 🎉')
    } else {
      alert(t('settings.license-inactive'))
    }
  })
}

const resetDiary = () => {
  const r = confirm(t('settings.reset-diary') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/pheDiary`))
    navigateTo(localePath('diary'))
  }
}

const resetLabValues = () => {
  const r = confirm(t('settings.reset-blood-values') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/labValues`))
    navigateTo(localePath('blood-values'))
  }
}

const resetOwnFood = () => {
  const r = confirm(t('settings.reset-own-food') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/ownFood`))
    navigateTo(localePath('own-food'))
  }
}

const deleteAccount = () => {
  const r = confirm(t('settings.delete-account') + '?')
  if (r === true) {
    const db = getDatabase()
    const auth = getAuth()
    remove(dbRef(db, store.user.id))
    auth.currentUser
      .delete()
      .then(() => {
        store.signOut()
        navigateTo(localePath('index'))
      })
      .catch((error) => {
        alert(t('settings.delete-account-error'))
        console.error(error)
      })
  }
}

const giveHealthDataConsent = async () => {
  const success = await store.updateHealthDataConsent(true)
  if (success) {
    alert(t('health-consent.consent-given'))
  } else {
    alert(t('health-consent.error-saving'))
  }
}

const revokeHealthDataConsent = async () => {
  const r = confirm(t('health-consent.revoke-confirm') + '?')
  if (r === true) {
    const success = await store.updateHealthDataConsent(false)
    if (success) {
      alert(t('health-consent.consent-revoked'))
    } else {
      alert(t('health-consent.error-revoking'))
    }
  }
}

const updateEmailConsent = async (emailConsent) => {
  const success = await store.updateEmailConsent(emailConsent)
  if (success) {
    alert(t('health-consent.email-consent-updated'))
  } else {
    alert(t('health-consent.error-updating-email'))
  }
}

const reopenOnboarding = () => {
  navigateTo(localePath('getting-started'))
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
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
        <br />
        <NuxtLink
          type="button"
          :to="$localePath('sign-in')"
          class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-6"
        >
          {{ $t('sign-in.signin-with-email') }}
        </NuxtLink>
      </div>
    </div>

    <div v-if="userIsAuthenticated">
      <!-- Getting Started Section -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('getting-started.title')" class="mb-4" />
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('getting-started.subtitle') }}
        </p>
        <SecondaryButton :text="$t('health-consent.reopen-onboarding')" @click="reopenOnboarding" />
      </div>

      <!-- Health Data Consent Section -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
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
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
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
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
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
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
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
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
      >
        <PageHeader :title="$t('settings.change-password')" class="mb-4" />
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('settings.change-password-info') }}
        </p>
      </div>

      <!-- Data Management Section -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
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
        <SecondaryButton :text="$t('settings.delete-account')" @click="deleteAccount" />
      </div>
    </div>
  </div>
</template>
