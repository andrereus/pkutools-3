<script setup>
/* global Headway */
import { useStore } from '../../stores/index'
import {
  LucideCircleUser,
  LucideUser,
  LucideHouse,
  LucideSearch,
  LucideCalculator,
  LucideScanBarcode,
  LucideApple,
  LucideBook,
  LucideMail,
  LucideLogIn,
  LucideLogOut,
  LucideSettings,
  LucideLifeBuoy,
  LucideInfo,
  LucideCalendar,
  LucideChartLine,
  LucideBot,
  LucidePlus
} from 'lucide-vue-next'

const store = useStore()
const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()

// Reactive state
const showCookieBanner = ref(false)

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const userPhotoUrl = computed(() => (store.user ? store.user.photoUrl : null))
const user = computed(() => store.user)

const navigation = computed(() => {
  return [
    { name: 'app.start', icon: 'LucideHouse', route: 'index' },
    { name: 'phe-calculator.title', icon: 'LucideCalculator', route: 'phe-calculator' },
    { name: 'food-search.title', icon: 'LucideSearch', route: 'food-search' },
    { name: 'barcode-scanner.title', icon: 'LucideScanBarcode', route: 'barcode-scanner' },
    { name: 'diary.title', icon: 'LucideCalendar', route: 'diary' },
    { name: 'diet-report.title', icon: 'LucideBook', route: 'diet-report' },
    { name: 'blood-values.title', icon: 'LucideChartLine', route: 'blood-values' },
    { name: 'assistant.title', icon: 'LucideBot', route: 'assistant' }
  ]
})

const tabNavigation = computed(() => {
  if (userIsAuthenticated.value) {
    return [
      { name: 'home.title', icon: 'LucideHouse', route: 'diary' },
      { name: 'diet-report.tab-title', icon: 'LucideBook', route: 'diet-report' },
      { name: 'common.add', icon: 'LucidePlus', route: 'phe-calculator' },
      { name: 'blood-values.tab-title', icon: 'LucideChartLine', route: 'blood-values' },
      { name: 'assistant.title', icon: 'LucideBot', route: 'assistant' }
    ]
  } else {
    return [
      { name: 'home.title', icon: 'LucideHouse', route: 'index' },
      { name: 'app.calculator', icon: 'LucideCalculator', route: 'phe-calculator' },
      { name: 'app.search', icon: 'LucideSearch', route: 'food-search' },
      { name: 'app.scanner', icon: 'LucideScanBarcode', route: 'barcode-scanner' },
      { name: 'sign-in.title', icon: 'LucideLogIn', route: 'sign-in' }
    ]
  }
})

const userNavigation = computed(() => {
  return [
    { name: 'own-food.title', icon: 'LucideApple', route: 'own-food' },
    { name: 'settings.title', icon: 'LucideSettings', route: 'settings' },
    { name: 'help.title', icon: 'LucideLifeBuoy', route: 'help' },
    { name: 'imprint.title', icon: 'LucideInfo', route: 'imprint' },
    { name: 'disclaimer.title', icon: 'LucideInfo', route: 'disclaimer' },
    { name: 'privacy-policy.title', icon: 'LucideInfo', route: 'privacy-policy' }
  ]
})

const footerNavigation = computed(() => {
  return {
    tools: [
      { name: 'phe-calculator.title', route: 'phe-calculator' },
      { name: 'food-search.title', route: 'food-search' },
      { name: 'barcode-scanner.title', route: 'barcode-scanner' }
    ],
    features: [
      { name: 'diary.title', route: 'diary' },
      { name: 'diet-report.title', route: 'diet-report' },
      { name: 'blood-values.title', route: 'blood-values' },
      { name: 'assistant.title', route: 'assistant' }
    ],
    account: [
      { name: 'sign-in.title', route: 'sign-in' },
      { name: 'own-food.title', route: 'own-food' },
      { name: 'settings.title', route: 'settings' }
    ],
    about: [
      { name: 'app.start', route: 'index' },
      { name: 'help.title', route: 'help' },
      { name: 'imprint.title', route: 'imprint' },
      { name: 'disclaimer.title', route: 'disclaimer' },
      { name: 'privacy-policy.title', route: 'privacy-policy' }
    ]
  }
})

const isTabActive = computed(() => (item) => {
  // Home-Tab aktiv für index und diary
  const homeRoutes = [localePath('index'), localePath('diary')]
  if (homeRoutes.includes(route.fullPath) && homeRoutes.includes(localePath(item.route))) {
    return true
  }
  // Hinzufügen-Tab aktiv für food-search, barcode-scanner und phe-calculator NUR wenn der Nutzer angemeldet ist
  if (userIsAuthenticated.value) {
    const addTabRoutes = [
      localePath('food-search'),
      localePath('barcode-scanner'),
      localePath('phe-calculator')
    ]
    if (addTabRoutes.includes(route.fullPath) && addTabRoutes.includes(localePath(item.route))) {
      return true
    }
  }
  // Standard: exakte Übereinstimmung
  return route.fullPath === localePath(item.route)
})

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

const signOut = () => {
  store.signOut()
}

onMounted(() => {
  store.checkAuthState()

  // Script gets loaded in index.html
  if (typeof Headway !== 'undefined') {
    const config = {
      selector: '.headway',
      account: 'JVmwL7'
    }
    Headway.init(config)
  }

  // Remove old local storage items
  const oldItems = ['vuetifyThemeDark', 'vuetifyThemeFromDevice', 'vuetifyCurrentTheme']
  oldItems.forEach((item) => {
    if (localStorage.getItem(item)) {
      localStorage.removeItem(item)
    }
  })

  // Set showCookieBanner based on localStorage
  showCookieBanner.value = !localStorage.getItem('cookie_consent')
})

// Add an icon map to reference the actual icon components
const iconMap = {
  LucideHouse,
  LucideSearch,
  LucideCalculator,
  LucideScanBarcode,
  LucideApple,
  LucideBook,
  LucideMail,
  LucideLogIn,
  LucideLogOut,
  LucideSettings,
  LucideLifeBuoy,
  LucideInfo,
  LucideCalendar,
  LucideChartLine,
  LucideBot,
  LucidePlus
}

const handleCookieConsent = (consent) => {
  if (window.posthog) {
    window.posthog.set_config({ persistence: consent === 'yes' ? 'localStorage+cookie' : 'memory' })
  }
  localStorage.setItem('cookie_consent', consent)
  showCookieBanner.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col app-container-safe-area dark:text-white">
    <div
      as="nav"
      class="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg shadow-sm"
      style="padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right)"
    >
      <div class="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
        <div class="relative flex h-16 justify-between">
          <div class="relative inset-y-0 left-0 flex items-center">
            <HeadlessMenu as="div" class="relative">
              <div>
                <HeadlessMenuButton
                  class="relative rounded-full p-1 text-gray-600 hover:text-black focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:text-gray-200 dark:hover:text-white cursor-pointer"
                >
                  <span class="absolute -inset-1.5" />
                  <span class="sr-only">{{ $t('app.main-menu') }}</span>
                  <LucideMenu class="h-6 w-6" aria-hidden="true" />
                </HeadlessMenuButton>
              </div>
              <transition
                enter-active-class="transition ease-out duration-200"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <HeadlessMenuItems
                  class="absolute left-0 z-10 mt-4 w-64 origin-top-left rounded-md bg-white py-1 shadow-lg ring-1 ring-gray-300 focus:outline-hidden dark:bg-gray-800 dark:ring-gray-700"
                >
                  <HeadlessMenuItem
                    v-for="item in navigation"
                    :key="item.name"
                    v-slot="{ active, close }"
                  >
                    <a
                      :class="[
                        active ? 'bg-gray-100 dark:bg-gray-700' : '',
                        route.fullPath === $localePath(item.route)
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : '',
                        'group flex items-center px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300'
                      ]"
                      @click.prevent="
                        () => {
                          navigateTo($localePath(item.route))
                          close()
                        }
                      "
                    >
                      <component
                        :is="iconMap[item.icon]"
                        class="mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300"
                        aria-hidden="true"
                      />{{ $t(item.name) }}
                    </a>
                  </HeadlessMenuItem>
                </HeadlessMenuItems>
              </transition>
            </HeadlessMenu>
          </div>

          <div class="flex flex-1 items-stretch justify-start ml-3">
            <NuxtLink
              :to="userIsAuthenticated ? $localePath('diary') : $localePath('index')"
              class="flex shrink-0 items-center"
            >
              <img class="h-8 w-auto mr-3" src="~/assets/pkutools-logo.png" alt="PKU Tools Logo" />
              <span class="dark:text-white">PKU Tools</span>
            </NuxtLink>
          </div>

          <div
            class="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0"
          >
            <button
              type="button"
              class="headway relative rounded-full p-1 text-gray-600 hover:text-black focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:text-gray-200 dark:hover:text-white"
            />

            <HeadlessMenu as="div" class="relative ml-2">
              <div>
                <HeadlessMenuButton
                  class="relative rounded-full p-1 text-gray-600 hover:text-black focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 uppercase dark:text-gray-200 dark:hover:text-white mr-2 cursor-pointer"
                >
                  {{ locale }}
                </HeadlessMenuButton>
              </div>
              <transition
                enter-active-class="transition ease-out duration-200"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <HeadlessMenuItems
                  class="absolute right-0 z-10 mt-4 w-40 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-gray-300 focus:outline-hidden dark:bg-gray-800 dark:ring-gray-700"
                >
                  <HeadlessMenuItem
                    v-for="localeItem in locales"
                    :key="localeItem.code"
                    v-slot="{ active, close }"
                  >
                    <a
                      :class="[
                        active ? 'bg-gray-100 dark:bg-gray-700' : '',
                        locale === localeItem.code ? 'bg-gray-100 dark:bg-gray-700' : '',
                        'block px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300'
                      ]"
                      @click.prevent="
                        () => {
                          setLocale(localeItem.code)
                          close()
                        }
                      "
                    >
                      {{ localeItem.name }}
                    </a>
                  </HeadlessMenuItem>
                </HeadlessMenuItems>
              </transition>
            </HeadlessMenu>

            <HeadlessMenu as="div" class="relative ml-3">
              <div>
                <HeadlessMenuButton
                  class="relative flex rounded-full text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 cursor-pointer"
                >
                  <span class="absolute -inset-1.5" />
                  <span class="sr-only">{{ $t('app.account-menu') }}</span>
                  <LucideCircleUser
                    v-if="!userIsAuthenticated"
                    class="h-6 w-6 dark:text-gray-300"
                    aria-hidden="true"
                  />
                  <LucideUser
                    v-if="userIsAuthenticated && !userPhotoUrl"
                    class="h-6 w-6 dark:text-gray-300"
                    aria-hidden="true"
                  />
                  <img
                    v-if="userIsAuthenticated && userPhotoUrl"
                    class="h-8 w-8 rounded-full ph-no-capture"
                    :src="userPhotoUrl"
                    :alt="$t('app.profile-picture')"
                  />
                </HeadlessMenuButton>
              </div>
              <transition
                enter-active-class="transition ease-out duration-200"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <HeadlessMenuItems
                  class="absolute right-0 z-10 mt-4 w-64 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-gray-300 focus:outline-hidden dark:bg-gray-800 dark:ring-gray-700 dark:divide-gray-700"
                >
                  <div class="py-1">
                    <HeadlessMenuItem v-if="!userIsAuthenticated" v-slot="{ active, close }">
                      <a
                        :class="[
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'group flex items-center px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300'
                        ]"
                        @click.prevent="
                          () => {
                            signInGoogle()
                            close()
                          }
                        "
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="25"
                          class="mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300"
                        >
                          <path
                            d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"
                            fill="currentColor"
                          />
                        </svg>
                        {{ $t('app.signin-google') }}
                      </a>
                    </HeadlessMenuItem>
                    <HeadlessMenuItem v-if="!userIsAuthenticated" v-slot="{ active, close }">
                      <a
                        :class="[
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'group flex items-center px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300'
                        ]"
                        @click.prevent="
                          () => {
                            navigateTo($localePath('sign-in'))
                            close()
                          }
                        "
                      >
                        <LucideMail
                          class="mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300"
                          aria-hidden="true"
                        />{{ $t('sign-in.signin-with-email') }}
                      </a>
                    </HeadlessMenuItem>
                    <HeadlessMenuItem v-if="userIsAuthenticated" v-slot="{ active, close }">
                      <a
                        :class="[
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'group flex items-center px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300 ph-no-capture'
                        ]"
                        @click.prevent="
                          () => {
                            navigateTo($localePath('settings'))
                            close()
                          }
                        "
                      >
                        <LucideUser
                          class="mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300"
                          aria-hidden="true"
                        />{{ user.name || user.email }}
                      </a>
                    </HeadlessMenuItem>
                    <HeadlessMenuItem v-if="userIsAuthenticated" v-slot="{ active, close }">
                      <a
                        :class="[
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'group flex items-center px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300'
                        ]"
                        @click.prevent="
                          () => {
                            signOut()
                            close()
                          }
                        "
                      >
                        <LucideLogOut
                          class="mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300"
                          aria-hidden="true"
                        />{{ $t('app.signout') }}
                      </a>
                    </HeadlessMenuItem>
                  </div>
                  <div class="py-1">
                    <HeadlessMenuItem
                      v-for="item in userNavigation"
                      :key="item.name"
                      v-slot="{ active, close }"
                    >
                      <a
                        :class="[
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          route.fullPath === $localePath(item.route)
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : '',
                          'group flex items-center px-6 py-3 text-gray-700 cursor-pointer dark:text-gray-300'
                        ]"
                        @click.prevent="
                          () => {
                            navigateTo($localePath(item.route))
                            close()
                          }
                        "
                      >
                        <component
                          :is="iconMap[item.icon]"
                          class="mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300"
                          aria-hidden="true"
                        />{{ $t(item.name) }}
                      </a>
                    </HeadlessMenuItem>
                  </div>
                </HeadlessMenuItems>
              </transition>
            </HeadlessMenu>
          </div>
        </div>
        <div class="border-b dark:border-gray-700" />
        <nav class="flex py-2 w-full space-x-1 md:space-x-2" aria-label="Global">
          <NuxtLink
            v-for="item in tabNavigation"
            :key="item.name"
            :to="$localePath(item.route)"
            :class="[
              'flex-1 flex justify-center',
              isTabActive(item)
                ? item.icon === 'LucidePlus'
                  ? 'group inline-flex items-center px-2 py-1 text-sm font-medium border border-sky-500 rounded-md bg-sky-50 dark:bg-sky-900 text-sky-600 dark:text-sky-300 transition'
                  : 'group inline-flex items-center px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300'
                : item.icon === 'LucidePlus'
                  ? 'group inline-flex items-center px-2 py-1 text-sm font-medium border border-sky-500 rounded-md bg-transparent text-sky-600 dark:text-sky-300 transition hover:bg-sky-50 dark:hover:bg-sky-900'
                  : 'group inline-flex items-center px-3 py-2 text-sm font-medium hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300'
            ]"
          >
            <component
              :is="iconMap[item.icon]"
              :class="[
                item.icon === 'LucidePlus'
                  ? 'md:mr-3 text-sky-600 dark:text-sky-300 h-6 w-6'
                  : 'md:mr-3 h-5 w-5 text-gray-700 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-300'
              ]"
              aria-hidden="true"
            />
            <span class="hidden lg:inline-block">{{ $t(item.name) }}</span>
          </NuxtLink>
        </nav>
      </div>
    </div>

    <div class="pb-5 lg:pb-10 grow pt-28">
      <main>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <slot />
        </div>
      </main>
    </div>

    <footer class="bg-white dark:bg-gray-800 hidden xl:block">
      <div class="mx-auto max-w-7xl px-6 py-12 sm:py-12 lg:px-8 lg:py-12">
        <div class="xl:grid xl:grid-cols-3 xl:gap-8">
          <NuxtLink
            :to="userIsAuthenticated ? $localePath('diary') : $localePath('index')"
            class="hidden lg:block"
          >
            <img class="h-8" src="~/assets/pkutools-logo.png" alt="PKU Tools Logo" />
          </NuxtLink>
          <div class="lg:mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div class="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  {{ $t('footer.tools') }}
                </h3>
                <ul role="list" class="mt-6 space-y-4">
                  <li v-for="item in footerNavigation.tools" :key="item.name">
                    <NuxtLink
                      :to="$localePath(item.route)"
                      class="text-sm/6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >{{ $t(item.name) }}</NuxtLink
                    >
                  </li>
                </ul>
              </div>
              <div class="mt-10 md:mt-0">
                <h3 class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  {{ $t('footer.logs') }}
                </h3>
                <ul role="list" class="mt-6 space-y-4">
                  <li v-for="item in footerNavigation.features" :key="item.name">
                    <NuxtLink
                      :to="$localePath(item.route)"
                      class="text-sm/6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >{{ $t(item.name) }}</NuxtLink
                    >
                  </li>
                </ul>
              </div>
            </div>
            <div class="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  {{ $t('footer.account') }}
                </h3>
                <ul role="list" class="mt-6 space-y-4">
                  <li v-for="item in footerNavigation.account" :key="item.name">
                    <NuxtLink
                      :to="$localePath(item.route)"
                      class="text-sm/6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >{{ $t(item.name) }}</NuxtLink
                    >
                  </li>
                </ul>
              </div>
              <div class="mt-10 md:mt-0">
                <h3 class="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  {{ $t('footer.about') }}
                </h3>
                <ul role="list" class="mt-6 space-y-4">
                  <li v-for="item in footerNavigation.about" :key="item.name">
                    <NuxtLink
                      :to="$localePath(item.route)"
                      class="text-sm/6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >{{ $t(item.name) }}</NuxtLink
                    >
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>

    <div
      v-if="showCookieBanner"
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 max-w-xl w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <span class="text-gray-800 dark:text-gray-100 text-sm">
        {{ $t('cookie-consent.message') }}
      </span>
      <div class="flex gap-2 justify-end">
        <button
          class="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          @click="handleCookieConsent('yes')"
        >
          {{ $t('cookie-consent.accept') }}
        </button>
        <button
          class="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-sm font-medium px-4 py-2 rounded-lg transition"
          @click="handleCookieConsent('no')"
        >
          {{ $t('cookie-consent.decline') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container-safe-area {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}
</style>
