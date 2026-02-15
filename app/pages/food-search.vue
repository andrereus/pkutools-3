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
const advancedFood = ref(null)
const loading = ref(false)
const fuseInstance = ref(null)
const cachedUsdaFood = ref(null)
const isSaving = ref(false)
const isVoting = ref(false)
const kcalReference = ref(null)
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const note = ref(null)

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const userId = computed(() => store.user?.id)
const ownFood = computed(() => store.ownFood)
const communityFoods = computed(() => store.communityFoods)

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
  phe.value = item.phe
  weight.value = 100
  kcalReference.value = item.kcal
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

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  const logEntry = {
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

// Navigate to own-food page to share with community (for own, not-yet-shared foods)
const goToShareWithCommunity = () => {
  dialog.value?.closeDialog()
  navigateTo(localePath('own-food'))
}

// Build Fuse index from cached data
const buildFuseIndex = () => {
  if (!cachedUsdaFood.value) return

  const food = cachedUsdaFood.value
    .concat(
      ownFood.value.map((item) => ({
        name: item.name,
        icon: item.icon,
        phe: item.phe,
        kcal: item.kcal,
        note: item.note || null,
        isOwnFood: true,
        isCommunityFood: false,
        isShared: item.shared || false,
        ownFoodCommunityKey: item.communityKey || null
      }))
    )
    .concat(
      communityFoods.value
        .filter((item) => {
          if (item.language !== locale.value) return false
          // Filter out hidden foods based on score threshold
          const score = (item.likes || 0) - (item.dislikes || 0)
          if (isCommunityFoodHidden(score)) return false
          if (item.contributorId === userId.value) return false
          return true
        })
        .map((item) => ({
          name: item.name,
          icon: item.icon,
          phe: item.phe,
          kcal: item.kcal,
          note: item.note || null,
          isOwnFood: false,
          isCommunityFood: true,
          communityFoodKey: item['.key'],
          likes: item.likes || 0,
          dislikes: item.dislikes || 0
        }))
    )

  fuseInstance.value = new Fuse(food, {
    keys: ['name', 'phe'],
    threshold: 0.2,
    minMatchCharLength: 2,
    ignoreLocation: true,
    useExtendedSearch: true
  })
}

// Load USDA data once
const loadUsdaData = async () => {
  if (cachedUsdaFood.value) return

  const foodData = await $fetch('/data/usda-phe-kcal.json')
  cachedUsdaFood.value = foodData.map((item) => ({
    name: item[locale.value] || item.en,
    emoji: item.emoji,
    phe: Math.round(item.phe * 1000),
    kcal: item.kcal,
    isOwnFood: false,
    isCommunityFood: false
  }))
}

// Rebuild index when user data changes
watch([ownFood, communityFoods], () => {
  if (cachedUsdaFood.value) {
    buildFuseIndex()
  }
})

const searchFood = async () => {
  loading.value = true

  // Load USDA data and build index once
  await loadUsdaData()
  if (!fuseInstance.value) {
    buildFuseIndex()
  }

  const results = fuseInstance.value.search(search.value.trim())
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
        <NuxtLink
          :to="$localePath('phe-calculator')"
          class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
        >
          <LucideCalculator class="h-5 w-5" /> {{ $t('app.calculator') }}
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
                class="ml-0.5 mr-1"
              >
                {{ item.emoji }}
              </span>
              {{ item.name }}
              <!-- Own food indicator badge -->
              <span
                v-if="item.isOwnFood && !item.isShared"
                class="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                :title="$t('food-search.own-food-indicator')"
              >
                <LucideUser class="h-3 w-3 mr-1" />
                {{ $t('food-search.own-food') }}
              </span>
              <!-- Shared own food indicator badge -->
              <span
                v-if="item.isOwnFood && item.isShared"
                class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                :title="$t('community.shared')"
              >
                <LucideUsers class="h-3 w-3 mr-1" />
                {{ $t('community.sharedBadge') }}
              </span>
              <!-- Community food indicator badge -->
              <span
                v-if="item.isCommunityFood"
                class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                :title="$t('community.communityFood')"
              >
                <LucideUsers class="h-3 w-3 mr-1" />
                {{ $t('community.communityFood') }}
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

      <p class="mt-6 text-gray-600 dark:text-gray-400 italic">
        {{ $t('food-search.search-info') }}
      </p>

      <!-- Add food call-to-action -->
      <div
        v-if="userIsAuthenticated"
        class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 px-4 py-3"
      >
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('food-search.add-food-description') }}
        </p>
        <SecondaryButton
          :text="$t('food-search.add-food')"
          class="mb-0! mr-0!"
          @click="navigateTo(localePath('own-food'))"
        />
      </div>

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
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
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
            class="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:focus-visible:outline-emerald-400 cursor-pointer"
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
            <span class="flex items-center gap-1">
              <LucideThumbsUp class="h-4 w-4 text-emerald-600" />
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
