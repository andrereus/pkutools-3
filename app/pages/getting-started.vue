<script setup>
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()
const notifications = useNotifications()
const { updateConsent, updateGettingStarted, updateSettings } = useApi()

const totalSteps = 4
const currentStep = ref(1)
const saving = ref(false)

// Step 1: Consent
const consentGiven = ref(store.settings?.healthDataConsent ?? false)
const emailConsent = ref(store.settings?.emailConsent ?? false)

// Step 2: Daily targets
const maxPhe = ref(store.settings?.maxPhe ?? null)
const maxKcal = ref(store.settings?.maxKcal ?? null)

// Step 3: Blood values
const labUnit = ref(store.settings?.labUnit ?? 'mgdl')
const bloodPheMin = ref(store.settings?.bloodPheMin ?? null)
const bloodPheMax = ref(store.settings?.bloodPheMax ?? null)
const bloodTyrMin = ref(store.settings?.bloodTyrMin ?? null)
const bloodTyrMax = ref(store.settings?.bloodTyrMax ?? null)

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)

const unitOptions = computed(() => [
  { title: 'mg/dL', value: 'mgdl' },
  { title: 'µmol/L', value: 'umoll' }
])

// Sync form fields while still on step 1 (Firebase data may load after mount).
// Past step 1 the user may be editing, so stop overwriting.
watch(
  () => store.settings,
  (settings) => {
    if (currentStep.value !== 1 || !settings) return
    consentGiven.value = settings.healthDataConsent ?? false
    emailConsent.value = settings.emailConsent ?? false
    maxPhe.value = settings.maxPhe ?? null
    maxKcal.value = settings.maxKcal ?? null
    labUnit.value = settings.labUnit ?? 'mgdl'
    bloodPheMin.value = settings.bloodPheMin ?? null
    bloodPheMax.value = settings.bloodPheMax ?? null
    bloodTyrMin.value = settings.bloodTyrMin ?? null
    bloodTyrMax.value = settings.bloodTyrMax ?? null
  }
)

// Watch for when Firebase data loads and redirect if onboarding was finished.
// Only while on step 1, so users going through the wizard are not pulled away.
watch(
  () => [store.user, store.settings?.gettingStartedCompleted],
  ([user, gettingStartedCompleted]) => {
    if (user && gettingStartedCompleted === true && currentStep.value === 1) {
      navigateTo(localePath('diary'))
    }
  },
  { immediate: true }
)

// If user signs out while on this page, send them home
watch(userIsAuthenticated, (newVal) => {
  if (!newVal) {
    navigateTo(localePath('index'))
  }
})

watch(currentStep, () => {
  if (import.meta.client) {
    window.scrollTo({ top: 0 })
  }
})

const handleConsentGiven = async () => {
  if (!consentGiven.value) return

  saving.value = true
  try {
    // Skip the API call when reopening onboarding with unchanged consent,
    // so consent date and history are not rewritten
    if (
      store.settings?.healthDataConsent !== true ||
      (store.settings?.emailConsent ?? false) !== emailConsent.value
    ) {
      await updateConsent({
        healthDataConsent: true,
        emailConsent: emailConsent.value
      })
    }
    currentStep.value = 2
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Update consent error:', error)
    notifications.error(t('health-consent.error-saving'))
  } finally {
    saving.value = false
  }
}

const handleConsentDeclined = async () => {
  try {
    // Save the declined consent separately from onboarding completion
    await updateConsent({
      healthDataConsent: false,
      emailConsent: emailConsent.value
    })
    await updateGettingStarted(true)

    // For existing users who decline, redirect to settings
    // For new users, redirect to home page
    if (store.user) {
      navigateTo(localePath('settings'))
    } else {
      navigateTo(localePath('index'))
    }
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Update consent error:', error)
    notifications.error(t('health-consent.error-saving'))
  }
}

const saveTargets = async () => {
  saving.value = true
  try {
    await updateSettings({
      maxPhe: maxPhe.value || null,
      maxKcal: maxKcal.value || null
    })
    currentStep.value = 3
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save settings error:', error)
  } finally {
    saving.value = false
  }
}

const saveBloodValues = async () => {
  saving.value = true
  try {
    await updateSettings({
      labUnit: labUnit.value,
      bloodPheMin: bloodPheMin.value || null,
      bloodPheMax: bloodPheMax.value || null,
      bloodTyrMin: bloodTyrMin.value || null,
      bloodTyrMax: bloodTyrMax.value || null
    })
    currentStep.value = 4
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save settings error:', error)
  } finally {
    saving.value = false
  }
}

const finish = async () => {
  saving.value = true
  try {
    await updateGettingStarted(true)
    navigateTo(localePath('diary'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Update getting started error:', error)
    notifications.error(t('health-consent.error-saving'))
  } finally {
    saving.value = false
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/getting-started',
      de: '/erste-schritte',
      es: '/primeros-pasos',
      fr: '/premiers-pas'
    }
  }
})

useSeoMeta({
  title: () => t('getting-started.title')
})

defineOgImage('NuxtSeo', {
  title: () => t('getting-started.title') + ' - PKU Tools',
  theme: '#0ea5e9'
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-2 py-4">
    <header class="text-center mb-8">
      <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl mb-4">
        {{ $t('getting-started.title') }}
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-400 mb-6">
        {{ $t('getting-started.subtitle') }}
      </p>

      <!-- Step indicator -->
      <div class="flex items-center justify-center gap-2 mb-2" aria-hidden="true">
        <div
          v-for="s in totalSteps"
          :key="s"
          class="h-2 rounded-full transition-all"
          :class="
            s === currentStep
              ? 'w-6 bg-sky-500'
              : s < currentStep
                ? 'w-2 bg-sky-500'
                : 'w-2 bg-gray-300 dark:bg-gray-600'
          "
        />
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('getting-started.step', { current: currentStep, total: totalSteps }) }}
      </p>
    </header>

    <!-- Step 1: Data Consent -->
    <div
      v-if="currentStep === 1"
      class="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        {{ $t('health-consent.title') }}
      </h2>

      <div class="space-y-4 mb-6">
        <div class="rounded-lg bg-sky-50 p-4 dark:bg-sky-900/20">
          <h3 class="font-medium text-sky-900 dark:text-sky-100 mb-2">
            {{ $t('health-consent.what-data') }}
          </h3>
          <p class="text-sm text-sky-800 dark:text-sky-200">
            {{ $t('health-consent.data-summary') }}
          </p>
        </div>

        <div class="rounded-lg bg-teal-50 p-4 dark:bg-teal-900/20">
          <h3 class="font-medium text-teal-900 dark:text-teal-100 mb-2">
            {{ $t('health-consent.privacy') }}
          </h3>
          <p class="text-sm text-teal-800 dark:text-teal-200">
            {{ $t('health-consent.privacy-summary') }}
          </p>
          <NuxtLink
            :to="localePath('privacy-policy')"
            class="mt-2 inline-block text-sm text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
          >
            {{ $t('health-consent.privacy-policy-link') }}
          </NuxtLink>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        <label class="flex items-start space-x-3">
          <input
            v-model="consentGiven"
            type="checkbox"
            class="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('health-consent.consent-text') }}
          </span>
        </label>

        <label class="flex items-start space-x-3">
          <input
            v-model="emailConsent"
            type="checkbox"
            class="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('health-consent.email-consent-text') }}
          </span>
        </label>
      </div>

      <div class="flex justify-between">
        <SecondaryButton :text="$t('health-consent.decline')" @click="handleConsentDeclined" />
        <PrimaryButton
          :text="$t('health-consent.accept')"
          :disabled="!consentGiven"
          :loading="saving"
          @click="handleConsentGiven"
        />
      </div>
    </div>

    <!-- Step 2: Daily Targets -->
    <div
      v-if="currentStep === 2"
      class="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {{ $t('getting-started.targets-title') }}
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {{ $t('getting-started.targets-description') }}
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {{ $t('getting-started.optional-hint') }}
      </p>

      <div class="grid grid-cols-2 gap-4 mb-6">
        <NumberInput v-model.number="maxPhe" id-name="max-phe" :label="$t('settings.max-phe')" />

        <NumberInput v-model.number="maxKcal" id-name="max-kcal" :label="$t('settings.max-kcal')" />
      </div>

      <div class="flex justify-between">
        <SecondaryButton :text="$t('getting-started.back')" @click="currentStep = 1" />
        <PrimaryButton
          :text="$t('getting-started.continue')"
          :loading="saving"
          @click="saveTargets"
        />
      </div>
    </div>

    <!-- Step 3: Blood Values -->
    <div
      v-if="currentStep === 3"
      class="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {{ $t('getting-started.blood-title') }}
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {{ $t('getting-started.blood-description') }}
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {{ $t('getting-started.optional-hint') }}
      </p>

      <SelectMenu v-model="labUnit" id-name="unit" :label="$t('blood-values.unit')" class="mb-4">
        <option v-for="option in unitOptions" :key="option.value" :value="option.value">
          {{ option.title }}
        </option>
      </SelectMenu>

      <div class="grid grid-cols-2 gap-4">
        <NumberInput
          v-model.number="bloodPheMin"
          id-name="blood-phe-min"
          :label="$t('settings.blood-phe-min') + (labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')"
        />

        <NumberInput
          v-model.number="bloodPheMax"
          id-name="blood-phe-max"
          :label="$t('settings.blood-phe-max') + (labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')"
        />
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6">
        <NumberInput
          v-model.number="bloodTyrMin"
          id-name="blood-tyr-min"
          :label="$t('settings.blood-tyr-min') + (labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')"
        />

        <NumberInput
          v-model.number="bloodTyrMax"
          id-name="blood-tyr-max"
          :label="$t('settings.blood-tyr-max') + (labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')"
        />
      </div>

      <div class="flex justify-between">
        <SecondaryButton :text="$t('getting-started.back')" @click="currentStep = 2" />
        <PrimaryButton
          :text="$t('getting-started.continue')"
          :loading="saving"
          @click="saveBloodValues"
        />
      </div>
    </div>

    <!-- Step 4: All Set -->
    <div
      v-if="currentStep === 4"
      class="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {{ $t('getting-started.done-title') }}
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {{ $t('getting-started.done-description') }}
      </p>

      <div class="space-y-4 mb-6">
        <div class="flex items-start gap-3">
          <LucideSearch class="h-5 w-5 mt-0.5 shrink-0 text-sky-500" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('food-search.title') }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('food-search.description') }}
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <LucideScanBarcode class="h-5 w-5 mt-0.5 shrink-0 text-sky-500" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('barcode-scanner.title') }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('barcode-scanner.description') }}
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <LucideSparkles class="h-5 w-5 mt-0.5 shrink-0 text-sky-500" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('ai-calculator.title') }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('ai-calculator.description') }}
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <LucideCalculator class="h-5 w-5 mt-0.5 shrink-0 text-sky-500" />
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('phe-calculator.title') }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('phe-calculator.description') }}
            </p>
          </div>
        </div>
      </div>

      <div class="flex justify-between">
        <SecondaryButton :text="$t('getting-started.back')" @click="currentStep = 3" />
        <PrimaryButton :text="$t('getting-started.go-diary')" :loading="saving" @click="finish" />
      </div>
    </div>
  </div>
</template>
