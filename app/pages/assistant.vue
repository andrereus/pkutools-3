<script setup>
import { useStore } from '../../stores/index'

const store = useStore()

const userIsAuthenticated = computed(() => store.user !== null)
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('assistant.title')" class="inline-block" />
    </header>

    <div v-if="!userIsAuthenticated">
      <SecondaryButton :text="$t('app.signin-google')" @click="store.signInGoogle" />
      <br />
      <NuxtLink
        type="button"
        :to="$localePath('sign-in')"
        class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-6"
      >
        {{ $t('sign-in.title') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <div class="space-y-6">
        <MotivationCard />
        <CurrentTipCard />
        <TodaysTipCard />
        <DietReportCard />
        <BloodValuesCard />
        <p class="mt-2">{{ $t('assistant.info') }}</p>
      </div>
    </div>
  </div>
</template>
