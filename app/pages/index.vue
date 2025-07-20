<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import PheLog from '../components/PheLog.vue'
import TiersCard from '../components/TiersCard.vue'
import {
  Search,
  Calculator,
  ScanBarcode,
  Apple,
  Book,
  ChartLine,
  Sparkles,
  Bot,
  Check
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const store = useStore()
const { t } = useI18n()
const publicPath = import.meta.env.BASE_URL

// Reactive state
const pheLog = ref(false)

// Features data
const features = [
  {
    name: 'features.search-name',
    description: 'features.search-description',
    icon: Search,
    route: '/phe-search'
  },
  {
    name: 'features.scanner-name',
    description: 'features.scanner-description',
    icon: ScanBarcode,
    route: '/barcode-scanner'
  },
  {
    name: 'features.calculator-name',
    description: 'features.calculator-description',
    icon: Calculator,
    route: '/phe-calculator'
  },
  {
    name: 'features.assistant-name',
    description: 'features.assistant-description',
    icon: Bot,
    route: '/assistant'
  },
  {
    name: 'features.diary-name',
    description: 'features.diary-description',
    icon: Book,
    route: '/?log=true'
  },
  {
    name: 'features.lab-values-name',
    description: 'features.lab-values-description',
    icon: ChartLine,
    route: '/lab-values'
  },
  {
    name: 'features.suggestions-name',
    description: 'features.suggestions-description',
    icon: Sparkles,
    route: '/?log=true'
  },
  {
    name: 'features.own-food-name',
    description: 'features.own-food-description',
    icon: Apple,
    route: '/own-food'
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
    router.push({ path: '/', query: { log: true } })
  } else {
    router.push({ path: '/', query: { home: true } })
  }
})

watch(
  () => route.query,
  (newQuery) => {
    if (newQuery.home) {
      pheLog.value = false
    } else if (newQuery.log) {
      pheLog.value = true
    }
  },
  { immediate: true }
)

// Lifecycle hooks
onMounted(() => {
  if (userIsAuthenticated.value && !route.query.home) {
    router.push({ path: '/', query: { log: true } })
  }
})
</script>

<template>
  <div>
    <PheLog v-if="pheLog" />

    <div v-if="!pheLog">
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
              :src="publicPath + 'video/demo.mp4'"
              autoplay
              loop
              muted
              playsinline
              class="w-full rounded-md shadow-2xl ring-1 ring-gray-900/10 dark:ring-gray-700"
            ></video>
          </div>
        </div>
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <div class="mx-auto mt-14 max-w-2xl sm:mt-16 lg:max-w-4xl">
            <dl
              class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16"
            >
              <RouterLink
                v-for="feature in features"
                :key="feature.name"
                :to="feature.route"
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
              </RouterLink>
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
              @click.prevent="signInGoogle"
              class="rounded-sm bg-sky-500 px-2 py-1 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 cursor-pointer"
            >
              {{ $t('app.signin-google') }}
            </a>
            <RouterLink
              to="/email-auth"
              class="rounded-sm bg-sky-500 px-2 py-1 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              {{ $t('email-auth.title') }}
            </RouterLink>
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
            <a
              href="https://play.google.com/store/apps/details?id=com.pkutools.twa"
              target="_blank"
            >
              <img
                alt="Get it on Google Play"
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                class="inline-block w-28 align-middle"
              />
            </a>
            <RouterLink
              to="/help"
              class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10"
            >
              {{ $t('app.install') }} <span aria-hidden="true">→</span>
            </RouterLink>
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
            <a href="https://www.buymeacoffee.com/andrereus" target="_blank">
              <img
                src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=andrereus&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff"
                alt="Buy Me A Coffee"
                class="w-40"
              />
            </a>
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
  </div>
</template>
