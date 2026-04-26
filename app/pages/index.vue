<script setup>
import { useStore } from '../../stores/index'
import {
  LucideSearch,
  LucideCalculator,
  LucideScanBarcode,
  LucideApple,
  LucideBook,
  LucideCalendar,
  LucideChartLine,
  LucideSparkles,
  LucideCamera,
  LucideArrowRight
} from 'lucide-vue-next'

const pheTools = [
  { name: 'home.phe-anywhere-ai', icon: LucideSparkles, route: 'ai-calculator' },
  { name: 'home.phe-anywhere-search', icon: LucideSearch, route: 'food-search' },
  { name: 'home.phe-anywhere-scanner', icon: LucideScanBarcode, route: 'barcode-scanner' },
  { name: 'home.phe-anywhere-calculator', icon: LucideCalculator, route: 'phe-calculator' }
]

const suggestionsDemo = [
  { nameKey: 'home.diet-mgmt-food-1', weight: 50 },
  { nameKey: 'home.diet-mgmt-food-2', weight: 100 },
  { nameKey: 'home.diet-mgmt-food-3', weight: 200 }
]

const overviewDiaryTotal = 320
const overviewDiaryLimit = 400
const overviewDietBars = [180, 240, 310, 280, 350, 290, 320]
const overviewDietMax = 400
const overviewBlood = [380, 350, 330, 295, 270]
const overviewBloodMax = 400

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()
const notifications = useNotifications()

// Features data (8 items for even layout: short descriptions, merged Own & Community Foods, merged AI features)
const features = [
  {
    name: 'features.ai-features-name',
    description: 'features.ai-features-description',
    icon: LucideSparkles,
    route: 'ai-calculator'
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
    name: 'features.calculator-name',
    description: 'features.calculator-description',
    icon: LucideCalculator,
    route: 'phe-calculator'
  },
  {
    name: 'features.diary-name',
    description: 'features.diary-description',
    icon: LucideCalendar,
    route: 'diary'
  },
  {
    name: 'features.diet-report-name',
    description: 'features.diet-report-description',
    icon: LucideBook,
    route: 'diet-report'
  },
  {
    name: 'features.blood-values-name',
    description: 'features.blood-values-description',
    icon: LucideChartLine,
    route: 'blood-values'
  },
  {
    name: 'features.own-community-name',
    description: 'features.own-community-description',
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
    notifications.error(t('app.auth-error'))
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

defineOgImage('NuxtSeo', {
  title: () => t('home.title') + ' - PKU Tools',
  description: () => t('home.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <div class="pt-3 pb-12 sm:pt-8 sm:pb-16">
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
          <iframe
            class="aspect-video w-full rounded-md shadow-2xl ring-1 ring-gray-900/10 dark:ring-gray-700"
            src="https://www.youtube-nocookie.com/embed/XUcei4Iuggc"
            title="YouTube video player"
            frameborder="0"
            allow="
              accelerometer;
              autoplay;
              clipboard-write;
              encrypted-media;
              gyroscope;
              picture-in-picture;
              web-share;
            "
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
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

    <div
      class="w-screen ml-[calc(50%-50vw)] bg-white dark:bg-gray-900 py-14 sm:py-20"
    >
      <div class="mx-auto max-w-5xl px-6 lg:px-8">
        <div class="grid items-center gap-10 lg:grid-cols-2">
          <div class="order-2 lg:order-1">
            <div
              class="relative mx-auto max-w-sm rounded-2xl bg-linear-to-br from-sky-500/10 to-indigo-500/10 dark:from-sky-400/10 dark:to-indigo-400/10 p-6 ring-1 ring-inset ring-sky-500/20 dark:ring-sky-400/20"
            >
              <div class="flex items-center justify-between gap-3">
                <div
                  class="grid h-20 w-20 shrink-0 grid-cols-2 grid-rows-2 gap-1.5 place-items-center rounded-xl bg-white dark:bg-gray-900 p-2 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10"
                >
                  <component
                    :is="tool.icon"
                    v-for="tool in pheTools"
                    :key="tool.name"
                    class="h-6 w-6 text-sky-500"
                    aria-hidden="true"
                  />
                </div>
                <LucideArrowRight class="h-6 w-6 text-gray-400 shrink-0" aria-hidden="true" />
                <div
                  class="flex h-20 flex-1 items-center justify-center rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10 relative"
                >
                  <span class="text-lg font-bold text-gray-900 dark:text-white">
                    {{ $t('home.phe-anywhere-badge') }}
                  </span>
                  <LucideSparkles
                    class="absolute -top-2 -right-2 h-5 w-5 text-amber-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="order-1 lg:order-2 text-center lg:text-left">
            <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {{ $t('home.phe-anywhere') }}
            </h2>
            <p class="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {{ $t('home.phe-anywhere-desc') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="pt-10 sm:pt-14 pb-10 sm:pb-14 px-6 lg:px-8">
      <div class="mx-auto max-w-5xl">
        <div class="grid items-center gap-10 lg:grid-cols-2">
          <div class="text-center lg:text-left">
            <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {{ $t('home.weight-photo') }}
            </h2>
            <p class="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {{ $t('home.weight-photo-desc') }}
            </p>
          </div>
          <div>
            <div
              class="relative mx-auto max-w-sm rounded-2xl bg-linear-to-br from-emerald-500/10 to-sky-500/10 dark:from-emerald-400/10 dark:to-sky-400/10 p-6 ring-1 ring-inset ring-emerald-500/20 dark:ring-emerald-400/20"
            >
              <div class="flex items-center justify-between gap-3">
                <div
                  class="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10"
                >
                  <LucideCamera class="h-9 w-9 text-gray-700 dark:text-gray-200" aria-hidden="true" />
                </div>
                <LucideArrowRight class="h-6 w-6 text-gray-400 shrink-0" aria-hidden="true" />
                <div
                  class="flex h-20 flex-1 items-center justify-center rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10 relative"
                >
                  <span class="text-xl font-bold text-gray-900 dark:text-white">
                    {{ $t('home.weight-photo-badge') }}
                  </span>
                  <LucideSparkles
                    class="absolute -top-2 -right-2 h-5 w-5 text-amber-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="w-screen ml-[calc(50%-50vw)] bg-white dark:bg-gray-900 pt-14 sm:pt-20 pb-8 sm:pb-10"
    >
      <div class="mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
          {{ $t('home.diet-mgmt') }}
        </h2>
        <p class="mx-auto mt-4 max-w-xl text-lg leading-8 text-gray-600 dark:text-gray-300">
          {{ $t('home.diet-mgmt-desc') }}
        </p>
        <div
          class="mt-8 mx-auto max-w-md rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-5 sm:p-6 ring-1 ring-gray-900/5 dark:ring-white/10 text-left"
        >
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <LucideSparkles class="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>{{ $t('home.diet-mgmt-suggestions') }}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="entry in suggestionsDemo"
              :key="entry.nameKey"
              type="button"
              class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              {{ entry.weight }}g {{ $t(entry.nameKey) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="w-screen ml-[calc(50%-50vw)] bg-white dark:bg-gray-900 pt-8 sm:pt-10 pb-14 sm:pb-20"
    >
      <div class="mx-auto max-w-5xl px-6 lg:px-8">
        <div class="grid items-center gap-10 lg:grid-cols-2">
          <div class="order-2 lg:order-1">
            <div
              class="relative mx-auto max-w-md rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-5 sm:p-6 ring-1 ring-gray-900/5 dark:ring-white/10"
            >
              <div class="space-y-3">
                <div
                  class="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 px-3 py-3 ring-1 ring-gray-900/5 dark:ring-white/5"
                >
                  <LucideCalendar class="h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white shrink-0">
                    {{ $t('diary.title') }}
                  </span>
                  <div class="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-sky-500"
                      :style="{ width: (overviewDiaryTotal / overviewDiaryLimit * 100) + '%' }"
                    />
                  </div>
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                    {{ overviewDiaryTotal }}/{{ overviewDiaryLimit }}
                  </span>
                </div>

                <div
                  class="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 px-3 py-3 ring-1 ring-gray-900/5 dark:ring-white/5"
                >
                  <LucideBook class="h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white shrink-0">
                    {{ $t('diet-report.title') }}
                  </span>
                  <div class="flex flex-1 items-end gap-1 h-7">
                    <div
                      v-for="(bar, i) in overviewDietBars"
                      :key="i"
                      class="flex-1 rounded-sm bg-sky-400 dark:bg-sky-500"
                      :style="{ height: (bar / overviewDietMax * 100) + '%' }"
                    />
                  </div>
                </div>

                <div
                  class="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 px-3 py-3 ring-1 ring-gray-900/5 dark:ring-white/5"
                >
                  <LucideChartLine class="h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white shrink-0">
                    {{ $t('blood-values.title') }}
                  </span>
                  <svg
                    viewBox="0 0 100 28"
                    class="h-7 flex-1"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <polyline
                      :points="overviewBlood.map((v, i) => `${(i / (overviewBlood.length - 1)) * 100},${28 - (v / overviewBloodMax) * 24}`).join(' ')"
                      fill="none"
                      stroke="rgb(14 165 233)"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      vector-effect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="order-1 lg:order-2 text-center lg:text-left">
            <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {{ $t('home.insights') }}
            </h2>
            <p class="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {{ $t('home.insights-desc') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div
      class="w-screen ml-[calc(50%-50vw)] bg-sky-50 dark:bg-sky-900/40 pt-14 sm:pt-20 pb-10 sm:pb-12"
    >
      <div class="mx-auto max-w-2xl px-6 lg:px-8 text-center">
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
            class="rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500 cursor-pointer"
            @click.prevent="signInGoogle"
          >
            {{ $t('app.signin-google') }}
          </a>
          <NuxtLink
            :to="$localePath('sign-in')"
            class="rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500"
          >
            {{ $t('sign-in.signin-with-email') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <div
      class="w-screen ml-[calc(50%-50vw)] bg-sky-50 dark:bg-sky-900/40 pt-10 sm:pt-12 pb-14 sm:pb-20"
    >
      <div class="mx-auto max-w-2xl px-6 lg:px-8 text-center">
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
            class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400"
          >
            {{ $t('app.install') }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <div
      class="w-screen ml-[calc(50%-50vw)] bg-white dark:bg-gray-900 py-14 sm:py-20"
    >
      <div class="mx-auto max-w-5xl px-6 lg:px-8">
        <TiersCard />
      </div>
    </div>

    <div class="pt-14 sm:pt-20 pb-8 sm:pb-12 px-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <p class="mx-auto max-w-xl text-lg leading-8 text-gray-600 dark:text-gray-300">
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
