<script setup>
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, push, update } from 'firebase/database'
import Fuse from 'fuse.js'
import { format } from 'date-fns'

const store = useStore()
const { t, locale } = useI18n()
const dialog = ref(null)
const config = useRuntimeConfig()
const localePath = useLocalePath()
const notifications = useNotifications()

// Reactive state
const search = ref('')
const phe = ref(null)
const weight = ref(100)
const name = ref('')
const emoji = ref('🌱')
const icon = ref(null)
const isOwnFood = ref(false)
const advancedFood = ref(null)
const loading = ref(false)
const kcalReference = ref(null)
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)
const ownFood = computed(() => store.ownFood)

const tableHeaders = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

// Methods
const loadItem = (item) => {
  name.value = item.name
  emoji.value = item.emoji || null
  icon.value = item.icon !== undefined ? item.icon : null
  isOwnFood.value = item.isOwnFood || false
  phe.value = item.phe
  weight.value = 100
  kcalReference.value = item.kcal
  selectedDate.value = format(new Date(), 'yyyy-MM-dd')
  dialog.value.openDialog()
}

const calculatePhe = () => {
  return Math.round((weight.value * phe.value) / 100)
}

const calculateKcal = () => {
  return Math.round((weight.value * kcalReference.value) / 100) || 0
}

const save = () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  const db = getDatabase()
  const logEntry = {
    name: name.value,
    emoji: emoji.value || null,
    icon: icon.value || null,
    pheReference: phe.value,
    kcalReference: Number(kcalReference.value) || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  const formattedDate = selectedDate.value
  const dateEntry = store.pheDiary.find((entry) => entry.date === formattedDate)

  if (dateEntry) {
    const updatedLog = [...(dateEntry.log || []), logEntry]
    const totalPhe = updatedLog.reduce((sum, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum, item) => sum + (item.kcal || 0), 0)
    update(dbRef(db, `${user.value.id}/pheDiary/${dateEntry['.key']}`), {
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })
  } else {
    if (
      store.pheDiary.length >= 14 &&
      store.settings.license !== config.public.pkutoolsLicenseKey
    ) {
      notifications.error(t('app.limit'))
    } else {
      push(dbRef(db, `${user.value.id}/pheDiary`), {
        date: formattedDate,
        phe: calculatePhe(),
        kcal: calculateKcal(),
        log: [logEntry]
      })
    }
  }
  dialog.value.closeDialog()
  navigateTo(localePath('diary'))
}

const searchFood = async () => {
  loading.value = true

  // Load multilingual food data
  const foodData = await $fetch('/data/usda-phe-kcal.json')

  // Map the food data to use the correct language
  const food = foodData
    .map((item) => ({
      name: item[locale.value] || item.en, // fallback to English if translation missing
      emoji: item.emoji,
      phe: Math.round(item.phe * 1000),
      kcal: item.kcal,
      isOwnFood: false
    }))
    .concat(
      ownFood.value.map((item) => ({
        name: item.name,
        icon: item.icon,
        phe: item.phe,
        kcal: item.kcal,
        isOwnFood: true
      }))
    )

  const fuse = new Fuse(food, {
    keys: ['name', 'phe'],
    threshold: 0.2,
    minMatchCharLength: 2,
    ignoreLocation: true,
    useExtendedSearch: true
  })

  const results = fuse.search(search.value.trim())
  advancedFood.value = results.map((result) => result.item)
  loading.value = false
}

definePageMeta({
  i18n: {
    paths: {
      en: '/food-search',
      de: '/lebensmittelsuche',
      es: '/busqueda-de-alimentos',
      fr: '/recherche-alimentaire'
    }
  }
})

useSeoMeta({
  title: () => t('food-search.title'),
  description: () => t('food-search.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('food-search.title') + ' - PKU Tools',
  description: () => t('food-search.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <div v-if="userIsAuthenticated" class="block mb-6">
      <nav class="flex flex-wrap gap-1 justify-center" aria-label="Tabs">
        <NuxtLink
          :to="$localePath('phe-calculator')"
          class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
        >
          <LucideCalculator class="h-5 w-5" /> {{ $t('app.calculator') }}
        </NuxtLink>
        <NuxtLink
          :to="$localePath('food-search')"
          class="inline-flex items-center gap-2 bg-black/5 dark:bg-white/15 text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
          aria-current="page"
        >
          <LucideSearch class="h-5 w-5" /> {{ $t('app.search') }}
        </NuxtLink>
        <NuxtLink
          :to="$localePath('barcode-scanner')"
          class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
        >
          <LucideScanBarcode class="h-5 w-5" /> {{ $t('app.scanner') }}
        </NuxtLink>
      </nav>
    </div>

    <header>
      <PageHeader :title="$t('food-search.title')" />
    </header>

    <div>
      <div class="w-full mb-6">
        <label for="search" class="sr-only">{{ $t('food-search.search') }}</label>
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <LucideSearch class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            id="search"
            v-model="search"
            type="search"
            name="search"
            :placeholder="$t('food-search.search')"
            autocomplete="off"
            class="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
            @input="searchFood"
          />
        </div>
      </div>

      <DataTable v-if="advancedFood !== null" :headers="tableHeaders">
        <tr
          v-for="(item, index) in advancedFood"
          :key="index"
          class="cursor-pointer"
          @click="loadItem(item)"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            <span class="flex items-center gap-1">
              <img
                v-if="item.icon !== undefined && item.icon !== ''"
                :src="'/images/food-icons/' + item.icon + '.svg'"
                onerror="this.src='/images/food-icons/organic-food.svg'"
                width="25"
                class="food-icon"
                alt="Food Icon"
              />
              <img
                v-if="(item.icon === undefined || item.icon === '') && item.emoji === undefined"
                :src="'/images/food-icons/organic-food.svg'"
                width="25"
                class="food-icon"
                alt="Food Icon"
              />
              <span
                v-if="(item.icon === undefined || item.icon === '') && item.emoji !== undefined"
                class="ml-0.5 mr-1"
              >
                {{ item.emoji }}
              </span>
              {{ item.name }}
              <!-- Own food indicator badge -->
              <span
                v-if="item.isOwnFood"
                class="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                :title="$t('food-search.own-food-indicator')"
              >
                <LucideUser class="h-3 w-3 mr-1" />
                {{ $t('food-search.own-food') }}
              </span>
            </span>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.phe }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.kcal }}
          </td>
        </tr>
      </DataTable>

      <p class="mt-8">{{ $t('food-search.search-info') }}</p>

      <ModalDialog
        ref="dialog"
        :title="emoji ? emoji + ' ' + name : name"
        :buttons="[
          { label: $t('common.add'), type: 'submit', visible: userIsAuthenticated },
          { label: $t('common.close'), type: 'simpleClose', visible: true }
        ]"
        @submit="save"
      >
        <DateInput
          v-if="userIsAuthenticated"
          v-model="selectedDate"
          id-name="date"
          :label="$t('common.date')"
        />
        <NumberInput v-model.number="weight" id-name="weight" :label="$t('common.weight-in-g')" />
        <div class="flex gap-4 my-6">
          <span class="flex-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>
      </ModalDialog>
    </div>
  </div>
</template>

<style scoped>
.food-icon {
  vertical-align: middle;
  display: inline-block;
}
</style>
