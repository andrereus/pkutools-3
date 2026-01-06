<script setup>
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()
const notifications = useNotifications()

const userIsAuthenticated = computed(() => store.user !== null)

const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    notifications.error(t('app.auth-error'))
    console.error(error)
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/insights',
      de: '/einblicke',
      es: '/insights',
      fr: '/insights'
    }
  }
})

useSeoMeta({
  title: () => t('insights.title'),
  description: () => t('insights.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('insights.title') + ' - PKU Tools',
  description: () => t('insights.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('insights.title')" class="inline-block" />
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
        <MotivationCard />
        <CurrentTipCard />
        <TodaysTipCard />
        <DietReportCard />
        <BloodValuesCard />
      </div>
    </div>
  </div>
</template>
