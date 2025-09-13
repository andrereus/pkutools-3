<script setup>
import { useStore } from '../../stores/index'
import {
  LucideSearch,
  LucideCalculator,
  LucideScanBarcode,
  LucideApple,
  LucideCalendar,
  LucideChartLine,
  LucideSparkles,
  LucideBot
} from 'lucide-vue-next'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()

// Features data
const features = [
  {
    name: 'features.calculator-name',
    description: 'features.calculator-description',
    icon: LucideCalculator,
    route: 'phe-calculator'
  },
  {
    name: 'features.search-name',
    description: 'features.search-description',
    icon: LucideSearch,
    route: 'food-search'
  },
  {
    name: 'features.scanner-name',
    description: 'features.scanner-description',
    icon: LucideScanBarcode,
    route: 'barcode-scanner'
  },
  {
    name: 'features.diary-name',
    description: 'features.diary-description',
    icon: LucideCalendar,
    route: 'diary'
  },
  {
    name: 'features.blood-values-name',
    description: 'features.blood-values-description',
    icon: LucideChartLine,
    route: 'blood-values'
  },
  {
    name: 'features.assistant-name',
    description: 'features.assistant-description',
    icon: LucideBot,
    route: 'assistant'
  },
  {
    name: 'features.suggestions-name',
    description: 'features.suggestions-description',
    icon: LucideSparkles,
    route: 'diary'
  },
  {
    name: 'features.own-food-name',
    description: 'features.own-food-description',
    icon: LucideApple,
    route: 'own-food'
  }
]

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

// Watchers
watch(userIsAuthenticated, (newVal) => {
  if (newVal) {
    navigateTo(localePath('diary'))
  }
})

useSeoMeta({
  title: () => t('home.title'),
  description: () => t('home.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('home.title') + ' - PKU Tools',
  description: () => t('home.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <div class="pt-3 pb-6 sm:py-8">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:text-center">
          <p
            class="mt-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl"
          >
            {{ $t('app.description') }}
          </p>
          <p class="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            {{ $t('app.long-description') }}
          </p>
        </div>
      </div>
      <div class="mt-10 flex justify-center sm:mt-12">
        <div
          class="max-w-4xl w-full rounded-xl bg-gray-900/5 dark:bg-gray-800 p-2 ring-1 ring-inset ring-gray-900/10 dark:ring-gray-700 lg:rounded-2xl lg:p-4"
        >
          <video
            src="/videos/pkutools-demo.mp4"
            autoplay
            loop
            muted
            playsinline
            preload="auto"
            class="w-full rounded-md shadow-2xl ring-1 ring-gray-900/10 dark:ring-gray-700"
          />
        </div>
      </div>
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto mt-14 max-w-2xl sm:mt-16 lg:max-w-4xl">
          <dl
            class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16"
          >
            <NuxtLink
              v-for="feature in features"
              :key="feature.name"
              :to="$localePath(feature.route)"
              class="relative pl-16"
            >
              <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500"
                >
                  <component :is="feature.icon" class="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                {{ $t(feature.name) }}
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600 dark:text-gray-300">
                {{ $t(feature.description) }}
              </dd>
            </NuxtLink>
          </dl>
        </div>
      </div>
    </div>

    <div class="pt-10 sm:pt-14 pb-8 sm:pb-12 px-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
          {{ $t('home.signin') }}
        </h2>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600 dark:text-gray-300">
          {{ $t('home.signin-desc') }}
        </p>
        <div
          v-if="!userIsAuthenticated"
          class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <a
            class="rounded-sm bg-sky-500 px-2 py-1 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 cursor-pointer"
            @click.prevent="signInGoogle"
          >
            {{ $t('app.signin-google') }}
          </a>
          <NuxtLink
            :to="$localePath('sign-in')"
            class="rounded-sm bg-sky-500 px-2 py-1 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {{ $t('sign-in.signin-with-email') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="pt-8 sm:pt-12 pb-8 sm:pb-12 px-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
          {{ $t('home.install') }}
        </h2>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600 dark:text-gray-300">
          {{ $t('home.install-desc') }}
        </p>
        <div class="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a href="https://play.google.com/store/apps/details?id=com.pkutools.twa" target="_blank">
            <img
              alt="Get it on Google Play"
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              class="inline-block w-28 align-middle"
            />
          </a>
          <NuxtLink
            :to="$localePath('help')"
            class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10"
          >
            {{ $t('app.install') }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <TiersCard class="pt-2" />

    <div class="pt-8 sm:pt-12 pb-8 sm:pb-12 px-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <p class="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600 dark:text-gray-300">
          {{ $t('home.about-description') }}
        </p>
        <div class="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a href="https://ko-fi.com/M4M0GIVPI" target="_blank"
            ><img
              height="36"
              style="border: 0px; height: 36px"
              src="https://storage.ko-fi.com/cdn/kofi5.png?v=6"
              border="0"
              alt="Buy Me a Coffee at ko-fi.com"
          /></a>
        </div>
      </div>
    </div>

    <div class="pt-8 sm:pt-12 pb-8 sm:pb-12 px-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
          {{ $t('home.social') }}
        </h2>
        <div class="mt-6 flex flex-row items-center gap-4 justify-center">
          <a
            href="https://www.facebook.com/pkutools"
            target="_blank"
            class="text-gray-600 hover:text-gray-800"
          >
            <span class="sr-only">Facebook</span>
            <svg fill="currentColor" viewBox="0 0 24 24" class="size-8" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
          <a
            href="https://www.youtube.com/@pkutools"
            target="_blank"
            class="text-gray-600 hover:text-gray-800"
          >
            <span class="sr-only">YouTube</span>
            <svg fill="currentColor" viewBox="0 0 24 24" class="size-8" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
