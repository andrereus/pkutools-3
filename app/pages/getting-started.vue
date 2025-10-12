<script setup>
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()

const consentGiven = ref(false)
const emailConsent = ref(false)

const handleConsentGiven = async () => {
  if (consentGiven.value) {
    const success = await store.updateHealthDataConsent(true, emailConsent.value)
    if (success) {
      navigateTo(localePath('diary'))
    } else {
      alert(t('health-consent.error-saving'))
    }
  }
}

const handleConsentDeclined = () => {
  // For existing users who decline, redirect to settings
  // For new users, redirect to home page
  if (store.user) {
    navigateTo(localePath('settings'))
  } else {
    navigateTo(localePath('index'))
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

defineOgImageComponent('NuxtSeo', {
  title: () => t('getting-started.title') + ' - PKU Tools',
  theme: '#3498db'
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8">
    <header class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {{ $t('getting-started.title') }}
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-400">
        {{ $t('getting-started.subtitle') }}
      </p>
    </header>

    <!-- Data Consent Section -->
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700"
    >
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {{ $t('health-consent.title') }}
      </h2>

      <div class="space-y-4 mb-6">
        <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <h3 class="font-medium text-blue-900 dark:text-blue-100 mb-2">
            {{ $t('health-consent.what-data') }}
          </h3>
          <p class="text-sm text-blue-800 dark:text-blue-200">
            {{ $t('health-consent.data-summary') }}
          </p>
        </div>

        <div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <h3 class="font-medium text-green-900 dark:text-green-100 mb-2">
            {{ $t('health-consent.privacy') }}
          </h3>
          <p class="text-sm text-green-800 dark:text-green-200">
            {{ $t('health-consent.privacy-summary') }}
          </p>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        <label class="flex items-start space-x-3">
          <input
            v-model="consentGiven"
            type="checkbox"
            class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('health-consent.consent-text') }}
          </span>
        </label>

        <label class="flex items-start space-x-3">
          <input
            v-model="emailConsent"
            type="checkbox"
            class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('health-consent.email-consent-text') }}
          </span>
        </label>
      </div>

      <div class="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
        <button
          @click="handleConsentDeclined"
          class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {{ $t('health-consent.decline') }}
        </button>
        <button
          @click="handleConsentGiven"
          :disabled="!consentGiven"
          class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
        >
          {{ $t('health-consent.accept') }}
        </button>
      </div>

      <div class="mt-4 text-center">
        <NuxtLink
          :to="localePath('privacy-policy')"
          class="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {{ $t('health-consent.privacy-policy-link') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
