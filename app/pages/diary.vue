<script setup>
import { useStore } from '../../stores/index'
import { format, parseISO, subDays, addDays } from 'date-fns'
import {
  LucideCalendar,
  LucideSparkles,
  LucideSun,
  LucideCoffee,
  LucideHeart,
  LucideZap
} from 'lucide-vue-next'

const store = useStore()
const { t } = useI18n()
const dialog2 = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const { isPremium } = useLicense()
const { addFoodItemToDiary, updateFoodItemInDiary, deleteFoodItemFromDiary, updateGettingStarted } = useApi()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)
const date = ref(format(new Date(), 'yyyy-MM-dd'))
const visibleItems = ref(5)
const ensuredOnboarding = ref(false)

const defaultItem = {
  name: '',
  emoji: null,
  icon: null,
  pheReference: null,
  kcalReference: null,
  weight: null,
  phe: null,
  kcal: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const pheDiary = computed(() => store.pheDiary)
const settings = computed(() => store.settings)

// License check is now done via useLicense composable
// Keep this for backward compatibility but use isPremium from composable
const license = computed(() => isPremium.value)

const tableHeaders = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'weight', title: t('common.weight') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const selectedDayLog = computed(() => {
  const entry = pheDiary.value.find((entry) => entry.date === date.value)
  return entry?.log || []
})

// Available greetings (headlines)
const greetings = [
  'diary.empty-state.greeting-1',
  'diary.empty-state.greeting-2',
  'diary.empty-state.greeting-3',
  'diary.empty-state.greeting-4',
  'diary.empty-state.greeting-5',
  'diary.empty-state.greeting-6'
]

// Available messages (text)
const messages = [
  'diary.empty-state.message-1',
  'diary.empty-state.message-2',
  'diary.empty-state.message-3',
  'diary.empty-state.message-4',
  'diary.empty-state.message-5',
  'diary.empty-state.message-6'
]

// Available icons
const icons = [LucideSun, LucideSparkles, LucideCoffee, LucideHeart, LucideZap, LucideCalendar]

// Get time-appropriate greeting key for greeting-1
const getTimeBasedGreeting = (greetingKey) => {
  if (greetingKey === 'diary.empty-state.greeting-1') {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      return 'diary.empty-state.greeting-1-morning'
    } else if (hour >= 12 && hour < 18) {
      return 'diary.empty-state.greeting-1-afternoon'
    } else {
      return 'diary.empty-state.greeting-1-evening'
    }
  }
  return greetingKey
}

// Select icon, headline, and text independently based on date
// Each day gets a different combination, but same date = same combination
const selectedGreeting = computed(() => {
  // Use date as seed to generate independent indices
  const dateHash = date.value.split('-').join('')
  const dateNum = parseInt(dateHash)
  
  // Generate different indices using simple hash with different offsets
  // This ensures icon, greeting, and message are selected independently
  const iconIndex = dateNum % icons.length
  const greetingIndex = (dateNum + 1000) % greetings.length
  const messageIndex = (dateNum + 2000) % messages.length
  
  return {
    icon: icons[iconIndex],
    greeting: getTimeBasedGreeting(greetings[greetingIndex]),
    message: messages[messageIndex]
  }
})

const userName = computed(() => {
  return store.user?.name || store.user?.email?.split('@')[0] || null
})

const selectedDiaryEntry = computed(
  () => pheDiary.value.find((entry) => entry.date === date.value) || null
)

const pheResult = computed(() => {
  return selectedDayLog.value.reduce((sum, item) => sum + item.phe, 0)
})

const kcalResult = computed(() => {
  return selectedDayLog.value.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0)
})

const lastAdded = computed(() => {
  // Get the food items from the last diary entries that have a log
  const lastEntries = pheDiary.value
    .filter((obj) => Array.isArray(obj.log))
    .slice(-5)
    .map((obj) => obj.log)

  // Flatten and reverse the array to prioritize the most recent items
  const flattenedLogs = [].concat(...lastEntries).reverse()

  // Use a Map to filter out duplicates and keep track of their recency-weighted score
  const itemMap = new Map()

  flattenedLogs.forEach((item, index) => {
    const recencyWeight = flattenedLogs.length / (index + 1) // More recent items have higher weight
    if (itemMap.has(item.name)) {
      const entry = itemMap.get(item.name)
      entry.score += recencyWeight
    } else {
      itemMap.set(item.name, { ...item, score: recencyWeight })
    }
  })

  // Convert the Map back to an array and sort by combined score (recency-weighted frequency)
  const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.score - a.score)

  // Limit to the top 10 items
  return sortedItems
})

// Note: isToday was removed as it's not used

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    notifications.error(t('app.auth-error'))
    console.error(error)
  }
}

const showMoreItems = () => {
  visibleItems.value += 5
}

const calculatePhe = () => {
  return Math.round((editedItem.value.weight * editedItem.value.pheReference) / 100) || 0
}

const calculateKcal = () => {
  return Math.round((editedItem.value.weight * editedItem.value.kcalReference) / 100) || 0
}

const editItem = (item, index) => {
  editedIndex.value = index
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog2.value.openDialog()
}

const addLastAdded = (item) => {
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog2.value.openDialog()
}

const deleteItem = async () => {
  if (!selectedDiaryEntry.value || editedIndex.value < 0) {
    return
  }

  // Capture values before closing (needed for API call and undo)
  const entryKey = selectedDiaryEntry.value['.key']
  const logIndex = editedIndex.value
  const entryDate = selectedDiaryEntry.value.date
  const deletedItem = JSON.parse(JSON.stringify(selectedDayLog.value[editedIndex.value]))

  // Close dialog immediately for instant feedback
  close()

  try {
    await deleteFoodItemFromDiary({
      entryKey: entryKey,
      logIndex: logIndex
    })

    notifications.success(t('diary.item-deleted'), {
      undoAction: async () => {
        try {
          // Restore the item by adding it back via save API
          await addFoodItemToDiary({
            date: entryDate,
            ...deletedItem
          })
        } catch (error) {
          console.error('Undo error:', error)
          notifications.error('Failed to restore item. Please add it manually.')
        }
      },
      undoLabel: t('common.undo')
    })
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Delete error:', error)
  }
}

const close = () => {
  dialog2.value.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Capture state before closing (needed to determine if editing or adding)
  const isEditing = selectedDiaryEntry.value && editedIndex.value > -1
  const entryKey = selectedDiaryEntry.value?.['.key']
  const logIndex = editedIndex.value
  const entryDate = date.value

  const newLogEntry = {
    name: editedItem.value.name,
    emoji: editedItem.value.emoji || null,
    icon: editedItem.value.icon || null,
    pheReference: Number(editedItem.value.pheReference) || null,
    kcalReference: Number(editedItem.value.kcalReference) || null,
    weight: Number(editedItem.value.weight),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  // Close dialog immediately for instant feedback
  close()

  try {
    if (isEditing && entryKey && logIndex > -1) {
      // Update existing item - use update API (validates server-side with Zod)
      await updateFoodItemInDiary({
        entryKey: entryKey,
        logIndex: logIndex,
        entry: newLogEntry
      })
      notifications.success(t('common.saved'))
    } else {
      // Add new item - use save API (validates server-side with Zod)
      await addFoodItemToDiary({
        date: entryDate,
        ...newLogEntry
      })
      notifications.success(t('common.saved'))
    }
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save error:', error)
  }
}

const prevDay = () => {
  const currentDate = parseISO(date.value)
  date.value = format(subDays(currentDate, 1), 'yyyy-MM-dd')
}

const nextDay = () => {
  const currentDate = parseISO(date.value)
  date.value = format(addDays(currentDate, 1), 'yyyy-MM-dd')
}

// Watchers
watch(userIsAuthenticated, (newVal) => {
  if (!newVal) {
    navigateTo(localePath('index'))
  }
})

// For legacy users: if consent was already set but onboarding flag is missing, set it
watch(
  () => [store.settings?.healthDataConsent, store.settings?.gettingStartedCompleted, store.user],
  async ([healthConsent, onboardingCompleted, user]) => {
    if (
      user &&
      healthConsent === true &&
      onboardingCompleted !== true &&
      !ensuredOnboarding.value
    ) {
      ensuredOnboarding.value = true
      try {
        await updateGettingStarted(true)
      } catch (error) {
        console.error('Update getting started error:', error)
      }
    }
  },
  { immediate: true }
)

definePageMeta({
  i18n: {
    paths: {
      en: '/diary',
      de: '/tagebuch',
      es: '/diario',
      fr: '/journal'
    }
  }
})

useSeoMeta({
  title: () => t('diary.title'),
  description: () => t('diary.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('diary.title') + ' - PKU Tools',
  description: () => t('diary.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('diary.tab-title')" class="inline-block" />
    </header>

    <div v-if="!userIsAuthenticated">
      <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
      <br />
      <NuxtLink
        type="button"
        :to="$localePath('sign-in')"
        class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 mr-3 mb-6"
      >
        {{ $t('sign-in.signin-with-email') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <div class="flex justify-between items-center gap-4 mb-6">
        <button class="p-1 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400" @click="prevDay">
          <LucideChevronLeft class="h-6 w-6" aria-hidden="true" />
        </button>
        <input
          id="date"
          v-model="date"
          type="date"
          name="date"
          class="flex-1 block w-full rounded-md border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        />
        <button class="p-1 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400" @click="nextDay">
          <LucideChevronRight class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div class="mb-6 py-3 px-3 bg-gray-100 dark:bg-gray-900 rounded-md shadow-inner">
        <div class="text-sm flex justify-between">
          <span>{{ pheResult }} Phe {{ $t('app.total') }}</span>
          <span v-if="settings?.maxPhe"
            >{{ settings.maxPhe - pheResult }} Phe {{ $t('app.left') }} ({{
              Math.round(((pheResult * 100) / settings.maxPhe - 100) * -1)
            }}%)</span
          >
          <NuxtLink v-if="!settings?.maxPhe" :to="$localePath('settings')">{{
            $t('diary.set-phe')
          }}</NuxtLink>
        </div>
        <div
          class="relative w-full bg-gray-200 dark:bg-gray-800 rounded-md overflow-hidden h-1 mt-2"
        >
          <div
            class="bg-sky-500 h-full rounded-md"
            :style="{ width: `${(pheResult * 100) / (settings?.maxPhe || 1)}%` }"
          />
        </div>
        <div class="text-sm flex justify-between mt-2">
          <span>{{ kcalResult }} {{ $t('common.kcal') }} {{ $t('app.total') }}</span>
          <span v-if="settings?.maxKcal"
            >{{ settings.maxKcal - kcalResult }} {{ $t('common.kcal') }} {{ $t('app.left') }} ({{
              Math.round(((kcalResult * 100) / settings.maxKcal - 100) * -1)
            }}%)</span
          >
          <NuxtLink v-if="!settings?.maxKcal" :to="$localePath('settings')">{{
            $t('diary.set-kcal')
          }}</NuxtLink>
        </div>
        <div
          class="relative w-full bg-gray-200 dark:bg-gray-800 rounded-md overflow-hidden h-1 mt-2"
        >
          <div
            class="bg-sky-500 h-full rounded-md"
            :style="{ width: `${(kcalResult * 100) / (settings?.maxKcal || 1)}%` }"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="selectedDayLog.length === 0"
        class="mt-6 mb-6 flex flex-col items-center justify-center py-6 px-4 text-center"
      >
        <component
          :is="selectedGreeting.icon"
          class="h-8 w-8 text-sky-500 dark:text-sky-400 mb-4"
          aria-hidden="true"
        />
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          <template v-if="userName">
            {{ $t(selectedGreeting.greeting, { name: userName }) }}
          </template>
          <template v-else>
            {{ $t(selectedGreeting.greeting, { name: $t('diary.empty-state.friend') }) }}
          </template>
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          {{ $t(selectedGreeting.message) }}
        </p>
      </div>

      <!-- Data Table -->
      <DataTable v-else :headers="tableHeaders" class="mb-6">
        <tr
          v-for="(item, index) in selectedDayLog"
          :key="index"
          class="cursor-pointer"
          @click="editItem(item, index)"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            <span class="flex items-center gap-1">
              <img
                v-if="item.icon !== undefined && item.icon !== null && item.icon !== ''"
                :src="'/images/food-icons/' + item.icon + '.svg'"
                onerror="this.src='/images/food-icons/organic-food.svg'"
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
            </span>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.weight }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.phe }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.kcal }}
          </td>
        </tr>
      </DataTable>

      <ModalDialog
        ref="dialog2"
        :title="formTitle"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="save"
        @delete="deleteItem"
        @close="close"
      >
        <p v-if="!editedItem.pheReference && editedIndex !== -1" class="mb-3">
          {{ $t('diary.data-warning') }}
        </p>
        <TextInput v-model="editedItem.name" id-name="food" :label="$t('common.food-name')" />
        <div class="flex gap-4">
          <NumberInput
            v-model.number="editedItem.pheReference"
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            class="flex-1"
          />
          <NumberInput
            v-model.number="editedItem.kcalReference"
            id-name="kcalRef"
            :label="$t('common.kcal-per-100g')"
            class="flex-1"
          />
        </div>
        <NumberInput
          v-model.number="editedItem.weight"
          id-name="weight"
          :label="$t('common.consumed-weight')"
        />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>
      </ModalDialog>

      <NuxtLink
        :to="$localePath('phe-calculator')"
        class="rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500 mr-3 mb-3"
      >
        {{ $t('common.add') }}
      </NuxtLink>

      <span v-if="lastAdded.length !== 0" class="mt-3">
        <SecondaryButton
          v-for="(item, index) in lastAdded.slice(0, visibleItems)"
          :key="index"
          :text="`${item.weight}g ${item.name.length > 14 ? item.name.slice(0, 13) + '…' : item.name}`"
          class="!t-font-normal"
          @click="addLastAdded(item)"
        />
        <SecondaryButton
          v-if="visibleItems < lastAdded.length"
          :text="$t('diary.more')"
          @click="showMoreItems"
        />
      </span>

      <p v-if="!license" class="mt-6 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.diary-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-6 text-sm">
        <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
        {{ $t('app.unlimited') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.food-icon {
  vertical-align: bottom;
  display: inline-block;
}
</style>
