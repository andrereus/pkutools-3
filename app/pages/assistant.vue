<script setup>
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()

const userIsAuthenticated = computed(() => store.user !== null)

const signInGoogle = async () => {
  try {
    await store.signInGoogle()
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
        <div
          class="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4"
        >
          <div class="flex items-start">
            <LucideInfo
              class="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0"
            />
            <div>
              <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                {{ $t('assistant.deactivated') }}
              </h3>
              <p class="text-sm text-blue-700 dark:text-blue-300">
                {{ $t('assistant.deactivated-explanation') }}
              </p>
            </div>
          </div>
        </div>
        <!-- <MotivationCard />
        <CurrentTipCard />
        <TodaysTipCard />
        <DietReportCard />
        <BloodValuesCard /> -->
      </div>
    </div>
  </div>
</template>
