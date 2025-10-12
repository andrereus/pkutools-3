<script setup>
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()

// Check if onboarding is needed
onMounted(() => {
  if (store.user && store.settings.healthDataConsent === undefined) {
    navigateTo(localePath('getting-started'))
  }
})

const userIsAuthenticated = computed(() => store.user !== null)

const signInGoogle = async () => {
  try {
    await store.signInGoogle()
    // Check if user has given health data consent
    if (store.settings.healthDataConsent === true) {
      navigateTo(localePath('diary'))
    } else {
      navigateTo(localePath('getting-started'))
    }
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/assistant',
      de: '/assistent',
      es: '/asistente',
      fr: '/assistant'
    }
  }
})

useSeoMeta({
  title: () => t('assistant.title'),
  description: () => t('assistant.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('assistant.title') + ' - PKU Tools',
  description: () => t('assistant.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('assistant.title')" class="inline-block" />
    </header>

    <div v-if="!userIsAuthenticated">
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

    <div v-if="userIsAuthenticated">
      <div class="space-y-6">
        <p>{{ $t('assistant.deactivated') }}</p>
        <!-- <MotivationCard />
        <CurrentTipCard />
        <TodaysTipCard />
        <DietReportCard />
        <BloodValuesCard /> -->
      </div>
    </div>
  </div>
</template>
