<script setup>
import { useStore } from '../../stores/index'
import Fuse from 'fuse.js'
import { format } from 'date-fns'
import { isCommunityFoodHidden } from '../utils/community-food'

const store = useStore()
const { t, locale } = useI18n()
const dialog = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const { addFoodItemToDiary, voteCommunityFood } = useApi()
const { ensureEmojiForLogEntry } = useFoodEmoji()

// Reactive state
const search = ref('')
const phe = ref(null)
const weight = ref(100)
const name = ref('')
const emoji = ref('🌱')
const icon = ref(null)
const isOwnFood = ref(false)
const isCommunityFood = ref(false)
const communityFoodKey = ref(null)
const isSharedOwnFood = ref(false)
const ownFoodCommunityKey = ref(null)
const selectedOwnFoodKey = ref(null)
const advancedFood = ref(null)
const visibleCount = ref(100)
const loading = ref(false)
const fuseInstance = ref(null)
const cachedStaticFood = ref(null)
const nutrients = ref(null)

// Source filter (all on by default, resets on every visit)
const showUsda = ref(true)
const showBls = ref(true)
const showOwn = ref(true)
const showCommunity = ref(true)
const sourceRefs = { usda: showUsda, bls: showBls, own: showOwn, community: showCommunity }
const isSaving = ref(false)
const isVoting = ref(false)
const kcalReference = ref(null)
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const note = ref(null)

// Computed properties
const blsAvailable = computed(() => locale.value === 'de' || locale.value === 'en')
const userIsAuthenticated = computed(() => store.user !== null)
const userId = computed(() => store.user?.id)
const ownFood = computed(() => store.ownFood)
const communityFoods = computed(() => store.communityFoods)

// Community foods that qualify for this user's search results
const visibleCommunityFoods = computed(() =>
  communityFoods.value.filter((item) => {
    if (item.language !== locale.value) return false
    // Filter out hidden foods based on score threshold
    const score = (item.likes || 0) - (item.dislikes || 0)
    if (isCommunityFoodHidden(score)) return false
    if (item.contributorId === userId.value) return false
    return true
  })
)

// Sources the filter offers; pills only appear when a source has content
const visibleSources = computed(() => {
  const sources = [{ key: 'usda', label: 'USDA' }]
  if (blsAvailable.value) sources.push({ key: 'bls', label: 'BLS' })
  if (ownFood.value.length > 0) sources.push({ key: 'own', label: t('food-search.own-food') })
  if (visibleCommunityFoods.value.length > 0)
    sources.push({ key: 'community', label: t('community.communityFood') })
  return sources
})

// Get current community food data for dialog (for community foods or shared own foods)
const currentCommunityFood = computed(() => {
  const key = communityFoodKey.value || ownFoodCommunityKey.value
  if (!key) return null
  return communityFoods.value.find((f) => f['.key'] === key) || null
})

// Get user's vote for current community food (stored in voterIds on the community food)
const currentUserVote = computed(() => {
  if (!communityFoodKey.value || !currentCommunityFood.value || !userId.value) return null
  return currentCommunityFood.value.voterIds?.[userId.value] || null
})

// Rendering thousands of rows at once freezes the page, so only a slice is mounted
const visibleFood = computed(() =>
  advancedFood.value ? advancedFood.value.slice(0, visibleCount.value) : []
)

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
  isCommunityFood.value = item.isCommunityFood || false
  communityFoodKey.value = item.communityFoodKey || null
  isSharedOwnFood.value = item.isShared || false
  ownFoodCommunityKey.value = item.ownFoodCommunityKey || null
  selectedOwnFoodKey.value = item.ownFoodKey || null
  phe.value = item.phe
  weight.value = 100
  kcalReference.value = item.kcal
  nutrients.value = item.nutrients || null
  note.value = item.note || null
  selectedDate.value = format(new Date(), 'yyyy-MM-dd')
  dialog.value.openDialog()
}

const calculatePhe = () => {
  return Math.round((weight.value * phe.value) / 100)
}

const calculateKcal = () => {
  return Math.round((weight.value * kcalReference.value) / 100) || 0
}

// Scale a per-100g nutrient value (in g) to the entered weight
const scaleNutrient = (value) => {
  if (value === null || value === undefined) return '–'
  return Math.round(((value * weight.value) / 100) * 10) / 10
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  let logEntry = {
    name: name.value,
    emoji: emoji.value || null,
    icon: icon.value || null,
    pheReference: phe.value,
    kcalReference: Number(kcalReference.value) || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note: note.value && note.value.trim() !== '' ? note.value.trim() : null
  }

  isSaving.value = true

  // Use server API for all writes - validates with Zod
  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

    await addFoodItemToDiary({
      date: selectedDate.value,
      ...logEntry,
      // Pass communityFoodKey to track usage count (will be stored in diary entry)
      // Check both communityFoodKey (for community foods) and ownFoodCommunityKey (for own shared foods)
      communityFoodKey: communityFoodKey.value || ownFoodCommunityKey.value || undefined
    })
    notifications.success(t('common.saved'))
    // Close dialog and navigate after successful save
    dialog.value.closeDialog()
    navigateTo(localePath('diary'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
}

// Vote on community food
const vote = async (voteValue) => {
  if (!communityFoodKey.value || !userIsAuthenticated.value) return

  isVoting.value = true
  try {
    await voteCommunityFood({
      communityFoodKey: communityFoodKey.value,
      vote: voteValue
    })
  } catch (error) {
    console.error('Vote error:', error)
  } finally {
    isVoting.value = false
  }
}

// Navigate to own-food page and open edit dialog for this item (share with community)
const goToShareWithCommunity = () => {
  const entryKey = selectedOwnFoodKey.value
  dialog.value?.closeDialog()
  const path = entryKey
    ? `${localePath('own-food')}?edit=${encodeURIComponent(entryKey)}`
    : localePath('own-food')
  navigateTo(path)
}

// Build Fuse index from cached data, honoring the source filter
const buildFuseIndex = () => {
  if (!cachedStaticFood.value) return

  const food = cachedStaticFood.value
    .filter((item) => (item.source === 'bls' ? showBls.value : showUsda.value))
    .concat(
      showOwn.value
        ? ownFood.value.map((item) => ({
            name: item.name,
            icon: item.icon,
            emoji: item.emoji,
            phe: item.phe,
            kcal: item.kcal,
            note: item.note || null,
            isOwnFood: true,
            isCommunityFood: false,
            isShared: item.shared || false,
            ownFoodCommunityKey: item.communityKey || null,
            ownFoodKey: item['.key']
          }))
        : []
    )
    .concat(
      showCommunity.value
        ? visibleCommunityFoods.value.map((item) => ({
            name: item.name,
            icon: item.icon,
            emoji: item.emoji,
            phe: item.phe,
            kcal: item.kcal,
            note: item.note || null,
            isOwnFood: false,
            isCommunityFood: true,
            communityFoodKey: item['.key'],
            likes: item.likes || 0,
            dislikes: item.dislikes || 0
          }))
        : []
    )

  fuseInstance.value = new Fuse(food, {
    keys: ['name', 'phe'],
    threshold: 0.2,
    minMatchCharLength: 2,
    ignoreLocation: true,
    useExtendedSearch: true
  })
}

// Load USDA and BLS data once, sharing one request across concurrent calls
let foodDataPromise = null
const loadFoodData = () => {
  if (!foodDataPromise) {
    foodDataPromise = Promise.all([
      $fetch('/data/usda-phe-kcal.json'),
      // BLS ships German and English names only, so es/fr skip the download
      blsAvailable.value ? $fetch('/data/bls-nutrients.json') : Promise.resolve([])
    ])
      .then(([usdaData, blsData]) => {
        const usdaFood = usdaData.map((item) => ({
          name: item[locale.value] || item.en,
          emoji: item.emoji,
          phe: Math.round(item.phe * 1000),
          kcal: item.kcal,
          source: 'usda',
          isOwnFood: false,
          isCommunityFood: false
        }))
        const blsFood = blsData.map((item) => ({
          name: locale.value === 'de' ? item.de : item.en,
          emoji: item.emoji,
          phe: Math.round(item.phe * 1000),
          kcal: item.kcal,
          source: 'bls',
          nutrients: {
            protein: item.protein,
            fat: item.fat,
            carbs: item.carbs,
            sugar: item.sugar,
            fiber: item.fiber,
            salt: item.salt
          },
          isOwnFood: false,
          isCommunityFood: false
        }))
        cachedStaticFood.value =
          locale.value === 'de' ? blsFood.concat(usdaFood) : usdaFood.concat(blsFood)
      })
      .catch((error) => {
        // Allow the next search to retry the download
        foodDataPromise = null
        throw error
      })
  }
  return foodDataPromise
}

// Toggle a source on/off, always keeping at least one active
const toggleSource = (key) => {
  const target = sourceRefs[key]
  const otherActive = visibleSources.value.some((s) => s.key !== key && sourceRefs[s.key].value)
  if (target.value && !otherActive) return
  target.value = !target.value
  buildFuseIndex()
  if (search.value.trim().length >= 2) {
    searchFood()
  }
}

// Rebuild index when user data changes
watch([ownFood, communityFoods], () => {
  if (cachedStaticFood.value) {
    buildFuseIndex()
  }
})

// Preload data and index so the first search is instant
onMounted(() => {
  loadFoodData()
    .then(() => {
      if (!fuseInstance.value) {
        buildFuseIndex()
      }
    })
    .catch(() => {})
})

const searchFood = async () => {
  const query = search.value.trim()

  // Fuse 7.3+ returns the entire collection for a blank query
  if (query.length < 2) {
    advancedFood.value = null
    return
  }

  loading.value = true

  // Load food data and build index once
  await loadFoodData()
  if (!fuseInstance.value) {
    buildFuseIndex()
  }

  const results = fuseInstance.value.search(query)
  visibleCount.value = 100
  advancedFood.value = results.map((result) => result.item)
  loading.value = false
}

const showMore = () => {
  visibleCount.value += 100
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

defineOgImage('NuxtSeo', {
  title: () => t('food-search.title') + ' - PKU Tools',
  description: () => t('food-search.description'),
  theme: '#0ea5e9'
})
</script>

<template>
  <div>
    <div v-if="userIsAuthenticated" class="block mb-6">
      <nav class="flex gap-3 justify-center" aria-label="Tabs">
        <NuxtLink
          :to="$localePath('food-search')"
          :title="$t('app.search')"
          class="bg-black/5 dark:bg-white/15 text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
          aria-current="page"
        >
          <LucideSearch class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.search') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="$localePath('barcode-scanner')"
          :title="$t('app.scanner')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideScanBarcode class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.scanner') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="$localePath('ai-calculator')"
          :title="$t('app.ai-calculator')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideSparkles class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.ai-calculator') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="$localePath('phe-calculator')"
          :title="$t('app.calculator')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideCalculator class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.calculator') }}</span>
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
            class="block w-full rounded-lg border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
            @input="searchFood"
          />
        </div>

        <!-- Source filter (only when there is more than one source) -->
        <div
          v-if="visibleSources.length > 1"
          class="mt-3 flex flex-wrap items-center gap-2 text-sm"
        >
          <span class="text-gray-500 dark:text-gray-400"> {{ $t('food-search.sources') }}: </span>
          <button
            v-for="sourceOption in visibleSources"
            :key="sourceOption.key"
            type="button"
            :aria-pressed="sourceRefs[sourceOption.key].value"
            :class="[
              'rounded-full px-3 py-1 text-sm font-medium cursor-pointer',
              sourceRefs[sourceOption.key].value
                ? 'bg-black/5 dark:bg-white/15 text-gray-700 dark:text-gray-300'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 line-through'
            ]"
            @click="toggleSource(sourceOption.key)"
          >
            {{ sourceOption.label }}
          </button>
        </div>
      </div>

      <DataTable v-if="advancedFood !== null" :headers="tableHeaders">
        <tr
          v-for="(item, index) in visibleFood"
          :key="index"
          class="cursor-pointer"
          @click="loadItem(item)"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            <span class="flex items-center gap-1">
              <img
                v-if="item.icon !== undefined && item.icon !== null && item.icon !== ''"
                :src="'/images/food-icons/' + item.icon + '.svg'"
                onerror="this.src = '/images/food-icons/organic-food.svg'"
                width="25"
                class="food-icon"
                alt="Food Icon"
              />
              <img
                v-if="
                  (item.icon === undefined || item.icon === null || item.icon === '') &&
                  (item.emoji === undefined || item.emoji === null)
                "
                :src="'/images/food-icons/organic-food.svg'"
                width="25"
                class="food-icon"
                alt="Food Icon"
              />
              <span
                v-if="
                  (item.icon === undefined || item.icon === null || item.icon === '') &&
                  item.emoji !== undefined &&
                  item.emoji !== null
                "
                class="ml-0.5 mr-1 text-xl inline-block align-middle leading-none"
              >
                {{ item.emoji }}
              </span>
              <!-- Name and badge share one inline block, so the badge wraps with the text -->
              <span class="wrap-anywhere">
                {{ item.name }}
                <!-- Reference database source badge -->
                <span
                  v-if="item.source"
                  class="inline-flex items-center align-middle rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  :title="
                    item.source === 'bls' ? 'BLS (Max Rubner-Institut)' : 'USDA (fdc.nal.usda.gov)'
                  "
                >
                  {{ item.source === 'bls' ? 'BLS' : 'USDA' }}
                </span>
                <!-- Own food indicator badge -->
                <span
                  v-if="item.isOwnFood && !item.isShared"
                  class="inline-flex items-center align-middle rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                  :title="$t('food-search.own-food-indicator')"
                >
                  <LucideUser class="h-3 w-3 mr-1" />
                  {{ $t('food-search.own-food') }}
                </span>
                <!-- Shared own food indicator badge -->
                <span
                  v-if="item.isOwnFood && item.isShared"
                  class="inline-flex items-center align-middle rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                  :title="$t('community.shared')"
                >
                  <LucideUsers class="h-3 w-3 mr-1" />
                  {{ $t('community.sharedBadge') }}
                </span>
                <!-- Community food indicator badge -->
                <span
                  v-if="item.isCommunityFood"
                  class="inline-flex items-center align-middle rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                  :title="$t('community.communityFood')"
                >
                  <LucideUsers class="h-3 w-3 mr-1" />
                  {{ $t('community.communityFood') }}
                </span>
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

      <div
        v-if="advancedFood !== null && advancedFood.length > visibleCount"
        class="mt-4 flex justify-center"
      >
        <button
          type="button"
          class="rounded-full bg-white dark:bg-white/15 px-4 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 cursor-pointer"
          @click="showMore"
        >
          {{ $t('food-search.show-more') }}
        </button>
      </div>

      <p class="mt-6 text-gray-600 dark:text-gray-400 italic text-sm">
        {{ $t('food-search.search-info') }}
      </p>
      <!-- Tool referrals: products in the scanner, estimates in the AI calculator, the rest in own food -->
      <p v-if="userIsAuthenticated" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        <i18n-t keypath="food-search.product-link" tag="span" scope="global">
          <template #tool>
            <NuxtLink
              :to="$localePath('barcode-scanner')"
              class="text-sky-600 dark:text-sky-400 hover:underline"
              >{{ $t('barcode-scanner.title') }}</NuxtLink
            >
          </template>
        </i18n-t>
        {{ ' ' }}
        <i18n-t keypath="food-search.not-found-link" tag="span" scope="global">
          <template #ai>
            <NuxtLink
              :to="$localePath('ai-calculator')"
              class="text-sky-600 dark:text-sky-400 hover:underline"
              >{{ $t('ai-calculator.title') }}</NuxtLink
            >
          </template>
          <template #own>
            <NuxtLink
              :to="$localePath('own-food')"
              class="text-sky-600 dark:text-sky-400 hover:underline"
              >{{ $t('food-search.not-found-link-own') }}</NuxtLink
            >
          </template>
        </i18n-t>
      </p>

      <ModalDialog
        ref="dialog"
        :title="emoji ? emoji + ' ' + name : name"
        :loading="isSaving"
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

        <!-- Nutrient breakdown (BLS foods) -->
        <div
          v-if="nutrients"
          class="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
        >
          <div class="flex justify-between">
            <span>{{ $t('common.protein') }}</span>
            <span>{{ scaleNutrient(nutrients.protein) }} g</span>
          </div>
          <div class="flex justify-between">
            <span>{{ $t('common.fat') }}</span>
            <span>{{ scaleNutrient(nutrients.fat) }} g</span>
          </div>
          <div class="flex justify-between">
            <span>{{ $t('common.carbs') }}</span>
            <span>{{ scaleNutrient(nutrients.carbs) }} g</span>
          </div>
          <div class="flex justify-between">
            <span>{{ $t('common.sugar') }}</span>
            <span>{{ scaleNutrient(nutrients.sugar) }} g</span>
          </div>
          <div class="flex justify-between">
            <span>{{ $t('common.fiber') }}</span>
            <span>{{ scaleNutrient(nutrients.fiber) }} g</span>
          </div>
          <div class="flex justify-between">
            <span>{{ $t('common.salt') }}</span>
            <span>{{ scaleNutrient(nutrients.salt) }} g</span>
          </div>
        </div>

        <!-- Note display -->
        <div
          v-if="note"
          class="mb-4 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <div class="flex items-start gap-2">
            <LucideStickyNote class="h-4 w-4 mt-0.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>{{ note }}</span>
          </div>
        </div>

        <!-- Community food voting section -->
        <div
          v-if="isCommunityFood && currentCommunityFood && userIsAuthenticated"
          class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <!-- Like button -->
              <button
                type="button"
                :disabled="isVoting"
                :class="[
                  'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                  currentUserVote === 1
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-teal-900/30 dark:hover:text-teal-400'
                ]"
                @click="vote(1)"
              >
                <LucideThumbsUp class="h-4 w-4" />
                {{ currentCommunityFood.likes || 0 }}
              </button>

              <!-- Dislike button -->
              <button
                type="button"
                :disabled="isVoting"
                :class="[
                  'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                  currentUserVote === -1
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                ]"
                @click="vote(-1)"
              >
                <LucideThumbsDown class="h-4 w-4" />
                {{ currentCommunityFood.dislikes || 0 }}
              </button>
            </div>

            <span class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('community.usageCount', { count: currentCommunityFood.usageCount || 0 }) }}
            </span>
          </div>
        </div>

        <!-- Share with community CTA when own food is not shared -->
        <div
          v-if="isOwnFood && !isSharedOwnFood && userIsAuthenticated"
          class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
        >
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-teal-50 dark:bg-teal-900/40 px-4 py-2 text-sm font-semibold text-teal-700 dark:text-teal-300 shadow-xs ring-1 ring-inset ring-teal-600/20 dark:ring-teal-400/20 hover:bg-teal-100 dark:hover:bg-teal-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:focus-visible:outline-teal-400 cursor-pointer"
            @click="goToShareWithCommunity"
          >
            <LucideUsers class="h-4 w-4" />
            {{ $t('community.share') }}
          </button>
        </div>

        <!-- Shared own food metrics section (display only, no voting) -->
        <div
          v-if="isSharedOwnFood && currentCommunityFood && userIsAuthenticated"
          class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2"
        >
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-medium">{{ $t('community.statistics') }}</span>
            <span class="flex items-center gap-1">
              <LucideThumbsUp class="h-4 w-4 text-teal-600" />
              {{ currentCommunityFood.likes || 0 }}
            </span>
            <span class="flex items-center gap-1">
              <LucideThumbsDown class="h-4 w-4 text-red-500" />
              {{ currentCommunityFood.dislikes || 0 }}
            </span>
            <span class="text-gray-400">
              {{ $t('community.usageCount', { count: currentCommunityFood.usageCount || 0 }) }}
            </span>
          </div>
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
