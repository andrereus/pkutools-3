<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import PageHeader from '../components/PageHeader.vue'
import SecondaryButton from '../components/SecondaryButton.vue'
import MotivationCard from '../components/MotivationCard.vue'
import CurrentTipCard from '../components/CurrentTipCard.vue'
import TodaysTipCard from '../components/TodaysTipCard.vue'
import PheDiaryCard from '../components/PheDiaryCard.vue'
import LabValuesCard from '../components/LabValuesCard.vue'

const store = useStore()
const { t } = useI18n()

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
        to="/email-auth"
        class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-6"
      >
        {{ $t('email-auth.title') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <div class="space-y-6">
        <MotivationCard />
        <CurrentTipCard />
        <TodaysTipCard />
        <PheDiaryCard />
        <LabValuesCard />
        <p class="mt-2">{{ $t('assistant.info') }}</p>
      </div>
    </div>
  </div>
</template>
