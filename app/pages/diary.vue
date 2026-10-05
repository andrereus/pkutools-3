<script setup>
import { useStore } from '../../stores/index'
import { format, parseISO, subDays, addDays } from 'date-fns'
import {
  LucideCalendar,
  LucideSparkles,
  LucideStickyNote,
  LucideSun,
  LucideCoffee,
  LucideHeart,
  LucideZap
} from '@lucide/vue'
import {
  scaleToWeight,
  nutrientRows,
  parseReference,
  pheContradictsConversion,
  diaryProvenanceAfterEdit
} from '../utils/nutrition'
import { hasMaterialFoodChange } from '#shared/utils/material-food'

const store = useStore()
const { accentColor, accentPalette } = useAccentColor()
const { t, locale } = useI18n()
const dialog2 = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const { isPremium, isPremiumAI } = useLicense()
const {
  addFoodItemToDiary,
  updateFoodItemInDiary,
  deleteFoodItemFromDiary,
  updateDiaryDay,
  updateGettingStarted
} = useApi()
const { ensureEmojiForLogEntry, fetchEmojiForFood } = useFoodEmoji()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)
// References are collapsed by default; the disclosure reveals the inputs
const showReferenceInputs = ref(false)
// The food name the current emoji was generated for; when the name is edited
// away from this, a refresh button offers to regenerate the emoji
const emojiBasisName = ref('')
const isRefreshingEmoji = ref(false)
// Premium users may replace an emoji they don't like once per opened dialog,
// without having to change the food name
const hasRerolledEmoji = ref(false)
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
  kcal: null,
  note: null,
  communityFoodKey: null,
  nutrients: null,
  factor: null,
  source: null,
  sourceId: null,
  addedFrom: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const pheDiary = computed(() => store.pheDiary)
const settings = computed(() => store.settings)

const license = computed(() => isPremium.value)

// The last column follows the Phe/Kcal toggle above the table
const tableHeaders = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'weight', title: t('common.weight') },
  { key: shareMetric.value, title: t(`common.${shareMetric.value}`) }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

// Show the emoji-refresh button once the name is edited away from what the
// current emoji represents (only when there is an emoji to replace)
const showEmojiRefresh = computed(() => {
  const name = editedItem.value.name?.trim()
  return !!editedItem.value.emoji && !!name && name !== emojiBasisName.value.trim()
})

// Premium extra: one replacement per opened dialog for an emoji that fits the
// name but isn't wanted. Free users get a new emoji by editing the name. Own
// Food exempts published foods from this gate because their icon is public;
// a diary emoji is a private snapshot, so no exemption applies here.
const canRerollEmoji = computed(() => {
  const name = editedItem.value.name?.trim()
  return isPremium.value && !!editedItem.value.emoji && !!name && !hasRerolledEmoji.value
})

// The corner button either updates the emoji after a name change or spends the
// premium reroll
const showEmojiAction = computed(() => showEmojiRefresh.value || canRerollEmoji.value)

const refreshEmoji = async () => {
  const name = editedItem.value.name?.trim()
  if (!name) return

  // Same name plus an existing emoji means the user wants a different emoji for
  // the same food — the premium reroll. The button is hidden when that isn't
  // allowed, so this only guards against a stale click.
  const isReroll = !!editedItem.value.emoji && name === emojiBasisName.value.trim()
  if (isReroll && !canRerollEmoji.value) return
  const previousEmoji = isReroll ? editedItem.value.emoji : null

  isRefreshingEmoji.value = true
  try {
    const emoji = await fetchEmojiForFood(name, previousEmoji)
    if (emoji && emoji !== previousEmoji) {
      editedItem.value.emoji = emoji
      // Advance the basis so the button hides until the name is edited again;
      // on a failed fetch it stays so the user can retry
      emojiBasisName.value = name
      if (isReroll) hasRerolledEmoji.value = true
    } else {
      // Surface the failure so the user isn't left re-clicking a silent button.
      // A reroll that came back with the same emoji isn't spent, so the retry
      // this message offers is actually available.
      notifications.error(t('errors.emoji-update-failed'))
    }
  } finally {
    isRefreshingEmoji.value = false
  }
}

// Time the opened entry was logged, shown in the dialog's top-right corner.
// Empty when adding a new item and for legacy entries without createdAt.
const editedItemTime = computed(() => {
  if (editedIndex.value === -1 || !editedItem.value.createdAt) return ''
  return new Date(editedItem.value.createdAt).toLocaleTimeString(locale.value, {
    hour: 'numeric',
    minute: '2-digit'
  })
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

// greeting-1 alone varies with the current clock time, so it is the one greeting
// that does not stay fixed for a given date
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

// Date-derived indices stay stable for a day; equal-length arrays keep the
// three selections coupled.
const selectedGreeting = computed(() => {
  const dateHash = date.value.split('-').join('')
  const dateNum = parseInt(dateHash)

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
  return selectedDayLog.value.reduce((sum, item) => sum + (Number(item.phe) || 0), 0)
})

const kcalResult = computed(() => {
  return selectedDayLog.value.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0)
})

// Which value the table's last column and the share bars show, Phe or Kcal.
// Transient per visit like `viewStyle`, so the diary always opens on Phe.
const shareMetric = ref('phe')

// Each row's share bar is measured against the metric's target, or against the
// day's total once that is higher (or no target is set), so bars never overflow.
// A segment starts where the previous rows' shares end, so the rows add up to the
// day's progress.
const shareSegments = computed(() => {
  const isPhe = shareMetric.value === 'phe'
  const target = (isPhe ? settings.value?.maxPhe : settings.value?.maxKcal) || 0
  const base = Math.max(target, isPhe ? pheResult.value : kcalResult.value)
  // Where the target sits on the row. Past it, a piece uses the darker over shade,
  // like the circles; a piece that crosses the target is split there.
  const limit = target > 0 ? (target * 100) / base : 100
  let start = 0
  return selectedDayLog.value.map((item) => {
    const value = Number(item[shareMetric.value]) || 0
    const width = value > 0 && base > 0 ? (value * 100) / base : 0
    const under = Math.max(0, Math.min(start + width, limit) - start)
    const segment = { start, under, over: width - under }
    start += width
    return segment
  })
})

// Over the target, a linear progress bar fills with the accent like the circles,
// and the overage takes the right end in the darker shade. The bar then stands for
// the day's total, so the overage starts where the food bars turn dark.
const progressBar = (result, max) => {
  const over = !!max && result > max
  const width = over ? ((result - max) * 100) / result : (result * 100) / (max || 1)
  return { over, width }
}
const pheBar = computed(() => progressBar(pheResult.value, settings.value?.maxPhe))
const kcalBar = computed(() => progressBar(kcalResult.value, settings.value?.maxKcal))

// Progress display style. `viewStyle` is a transient per-visit override that can
// be toggled freely without changing the saved preference; while it's null the
// view follows the saved default (settings.progressStyle), which is set in
// Settings. Re-entering the diary remounts this page, so the default shows first.
const viewStyle = ref(null)
const progressStyle = computed(() => viewStyle.value ?? settings.value?.progressStyle ?? 'circles')

const phePercent = computed(() =>
  settings.value?.maxPhe ? Math.round((pheResult.value * 100) / settings.value.maxPhe) : 0
)
const kcalPercent = computed(() =>
  settings.value?.maxKcal ? Math.round((kcalResult.value * 100) / settings.value.maxKcal) : 0
)

// Amount still left (positive) or over the limit (negative) for the circle captions
const pheRemaining = computed(() => (settings.value?.maxPhe ?? 0) - pheResult.value)
const kcalRemaining = computed(() => (settings.value?.maxKcal ?? 0) - kcalResult.value)

// Reactive dark-mode flag (kept in sync with the <html> class by an observer in
// onMounted). Reading the DOM class directly inside the options isn't reactive,
// so without this the rings wouldn't re-theme until a page refresh.
const isDark = ref(
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
)

// Radial bar options shared by both circles, themed for the current color mode.
// When over budget the track shows the full sky-colored ring (100% reached) and the
// overage continues on top in a darker shade, conveying how far past the limit.
const buildCircleOptions = (label, percent, total, size) => {
  const dark = isDark.value
  const over = percent > 100
  const small = size < 96
  const accent = accentPalette.value.primary
  // Over-budget overage colour: a darker shade of the same accent, used in both
  // light and dark mode. The full sky-colored ring + darker overage on top reads as
  // "over budget" consistently.
  const overColor = accentPalette.value.strong
  return {
    chart: {
      type: 'radialBar',
      background: 'transparent',
      offsetY: 0
    },
    plotOptions: {
      radialBar: {
        // Smaller hollow on phones keeps the ring band thick on the small circle.
        hollow: { size: small ? '46%' : '56%' },
        track: { background: over ? accent : dark ? '#374151' : '#e5e7eb' },
        dataLabels: {
          // Metric name comes from the caption beside the chart, so only the
          // day's total is shown in the centre (vertically centred); the ring
          // itself already shows the share of the target.
          name: { show: false },
          value: {
            offsetY: small ? 5 : 6,
            fontSize: small ? '14px' : '17px',
            fontWeight: 600,
            color: dark ? '#f3f4f6' : '#111827',
            formatter: () => `${total}`
          }
        }
      }
    },
    labels: [label],
    colors: [over ? overColor : accent],
    // Match the progress bars: neither a gradient nor the default 85% opacity.
    fill: { type: 'solid', opacity: 1 },
    stroke: { lineCap: 'round' },
    theme: { mode: dark ? 'dark' : 'light' }
  }
}

// Arc length to draw: under budget shows the actual %, over budget shows just
// the overage (0–100) layered on top of the full sky-colored track.
const circleSeries = (percent) => (percent > 100 ? Math.min(percent - 100, 100) : percent)

const pheCircleOptions = computed(() =>
  buildCircleOptions(t('common.phe'), phePercent.value, pheResult.value, circleSize.value)
)
const kcalCircleOptions = computed(() =>
  buildCircleOptions(t('common.kcal'), kcalPercent.value, kcalResult.value, circleSize.value)
)
const pheCircleSeries = computed(() => circleSeries(phePercent.value))
const kcalCircleSeries = computed(() => circleSeries(kcalPercent.value))

// Circle diameter: smaller on phones so the two circles + their labels still fit
// side by side, larger on wider screens. ApexCharts takes a fixed pixel size, so
// we drive it from a media query rather than CSS.
const circleSize = ref(
  typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches ? 88 : 92
)
let circleMq = null
const applyCircleSize = () => {
  if (circleMq) circleSize.value = circleMq.matches ? 92 : 88
}
let themeObserver = null
onMounted(() => {
  circleMq = window.matchMedia('(min-width: 640px)')
  applyCircleSize()
  circleMq.addEventListener('change', applyCircleSize)

  const root = document.documentElement
  themeObserver = new MutationObserver(() => {
    isDark.value = root.classList.contains('dark')
  })
  themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] })
})
onUnmounted(() => {
  if (circleMq) circleMq.removeEventListener('change', applyCircleSize)
  themeObserver?.disconnect()
})

const setProgressStyle = (style) => {
  // Transient: only changes what's shown this visit, not the saved default.
  viewStyle.value = style
}

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

  // The template pages through these, so the full ranked list is returned
  return sortedItems
})

// Methods

const showMoreItems = () => {
  visibleItems.value += 5
}

// Without a reference there is nothing to calculate from — the stored result
// stays authoritative (ancient entries stored only the result). A reference of
// 0 is a reference: spirits and oils really do contain no Phe, and treating
// that as "missing" would keep the previous total against the new 0.
const calculatePhe = () => {
  const reference = parseReference(editedItem.value.pheReference)
  if (reference === null) return Math.round(Number(editedItem.value.phe)) || 0
  return scaleToWeight(reference, editedItem.value.weight)
}

const calculateKcal = () => {
  const reference = parseReference(editedItem.value.kcalReference)
  if (reference === null) return Math.round(Number(editedItem.value.kcal)) || 0
  return scaleToWeight(reference, editedItem.value.weight)
}

const entryNutrientRows = computed(() =>
  nutrientRows(editedItem.value.nutrients, editedItem.value.weight, t)
)

// Material edits are measured against the snapshot that opened the dialog.
// Weight, notes and presentation fields are deliberately outside this shape.
const itemContradictsConversion = (item) =>
  pheContradictsConversion(item.pheReference, item.nutrients?.protein, item.factor)

const materialValues = (item) => ({
  name: item.name,
  phe: parseReference(item.pheReference),
  kcal: parseReference(item.kcalReference),
  nutrients: item.nutrients,
  factor: item.factor
})
const openedMaterialValues = ref(null)

const editItem = (item, index) => {
  editedIndex.value = index
  editedItem.value = JSON.parse(JSON.stringify(item))
  openedMaterialValues.value = materialValues(editedItem.value)
  // Expand inconsistent conversions automatically.
  showReferenceInputs.value = itemContradictsConversion(editedItem.value)
  emojiBasisName.value = editedItem.value.name || ''
  hasRerolledEmoji.value = false
  dialog2.value.openDialog()
}

const addLastAdded = (item) => {
  editedItem.value = JSON.parse(JSON.stringify(item))
  openedMaterialValues.value = materialValues(editedItem.value)
  // Expand inconsistent conversions automatically.
  showReferenceInputs.value = itemContradictsConversion(editedItem.value)
  emojiBasisName.value = editedItem.value.name || ''
  hasRerolledEmoji.value = false
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
  const itemLocator = deletedItem.itemId ? { itemId: deletedItem.itemId } : { logIndex: logIndex }

  // Close dialog immediately for instant feedback
  close()

  try {
    await deleteFoodItemFromDiary({
      entryKey: entryKey,
      ...itemLocator
    })

    notifications.success(t('diary.item-deleted'), {
      undoAction: async () => {
        try {
          const restoredItem = await ensureEmojiForLogEntry(deletedItem)
          await addFoodItemToDiary({
            date: entryDate,
            ...restoredItem,
            communityFoodKey: restoredItem.communityFoodKey || undefined
          })
        } catch (error) {
          console.error('Undo error:', error)
          notifications.error(t('errors.restore-failed'))
        }
      },
      undoLabel: t('common.undo')
    })
  } catch (error) {
    console.error('Delete error:', error)
  }
}

const close = () => {
  dialog2.value.closeDialog()
  editedItem.value = { ...defaultItem }
  openedMaterialValues.value = null
  editedIndex.value = -1
  editedKey.value = null
  showReferenceInputs.value = false
  emojiBasisName.value = ''
  isRefreshingEmoji.value = false
  hasRerolledEmoji.value = false
}

const isSaving = ref(false)

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Capture state (needed to determine if editing or adding)
  const isEditing = selectedDiaryEntry.value && editedIndex.value > -1
  const entryKey = selectedDiaryEntry.value?.['.key']
  const logIndex = editedIndex.value
  const itemLocator = editedItem.value.itemId
    ? { itemId: editedItem.value.itemId }
    : { logIndex: logIndex }
  const entryDate = date.value

  const pheReference = parseReference(editedItem.value.pheReference)
  const kcalReference = parseReference(editedItem.value.kcalReference)
  const materialChange =
    openedMaterialValues.value !== null &&
    hasMaterialFoodChange(openedMaterialValues.value, {
      name: editedItem.value.name,
      phe: pheReference,
      kcal: kcalReference,
      nutrients: editedItem.value.nutrients,
      factor: editedItem.value.factor
    })

  let newLogEntry = {
    name: editedItem.value.name,
    emoji: editedItem.value.emoji || null,
    icon: editedItem.value.icon || null,
    pheReference,
    kcalReference,
    weight: Number(editedItem.value.weight),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note:
      editedItem.value.note && editedItem.value.note.trim() !== ''
        ? editedItem.value.note.trim()
        : null,
    communityFoodKey: editedItem.value.communityFoodKey || null,
    nutrients: editedItem.value.nutrients || null,
    // Original provenance and collection history survive; only the monotonic
    // edit flag changes.
    ...diaryProvenanceAfterEdit(editedItem.value, materialChange)
  }

  isSaving.value = true
  try {
    newLogEntry = await ensureEmojiForLogEntry(newLogEntry)

    if (isEditing && entryKey && logIndex > -1) {
      // Update existing item - validates server-side with Zod
      await updateFoodItemInDiary({
        entryKey: entryKey,
        ...itemLocator,
        entry: newLogEntry
      })
    } else {
      // Add new item - validates server-side with Zod
      await addFoodItemToDiary({
        date: entryDate,
        ...newLogEntry,
        // Pass communityFoodKey to increment usage count (will be stored in entry)
        communityFoodKey: newLogEntry.communityFoodKey || undefined
      })
    }
    notifications.success(t('common.saved'))
    // Close only on success so the user's input is preserved when it fails
    close()
  } catch (error) {
    // Error shown by useApi composable; dialog stays open to fix the input
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
}

const toggleIncomplete = async () => {
  if (!selectedDiaryEntry.value) return
  const entry = selectedDiaryEntry.value
  const incomplete = !entry.incomplete
  // Flip the store entry before the request so the switch reacts instantly;
  // the RTDB echo confirms it, and an error reverts it.
  entry.incomplete = incomplete
  try {
    await updateDiaryDay({
      entryKey: entry['.key'],
      date: entry.date,
      phe: entry.phe ?? 0,
      kcal: entry.kcal ?? 0,
      incomplete
    })
  } catch (error) {
    entry.incomplete = !incomplete
    console.error('Toggle incomplete error:', error)
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

const isToday = computed(() => date.value === format(new Date(), 'yyyy-MM-dd'))

const goToday = () => {
  date.value = format(new Date(), 'yyyy-MM-dd')
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

defineOgImage('Default', {
  title: () => t('diary.title') + ' - PKU Tools',
  description: () => t('diary.description')
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('diary.tab-title')" class="inline-block" />
    </header>

    <div v-if="!userIsAuthenticated">
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ $t('diary.description') }}</p>
      <NuxtLink
        type="button"
        :to="$localePath('sign-in')"
        class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 mr-3 mb-6"
      >
        {{ $t('sign-in.title') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <div class="flex justify-between items-center gap-4 mb-6">
        <button
          :aria-label="$t('common.previous')"
          class="p-1 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400"
          @click="prevDay"
        >
          <LucideChevronLeft class="h-6 w-6" aria-hidden="true" />
        </button>
        <input
          id="date"
          v-model="date"
          type="date"
          name="date"
          class="flex-1 block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        />
        <button
          :disabled="isToday"
          class="rounded-lg bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 disabled:cursor-default disabled:opacity-40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          @click="goToday"
        >
          {{ $t('common.today') }}
        </button>
        <button
          :aria-label="$t('common.next')"
          class="p-1 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400"
          @click="nextDay"
        >
          <LucideChevronRight class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div
        class="relative mb-6 py-3 px-3 rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
      >
        <!-- Header: label + view toggle (progress bars vs. circles) -->
        <div class="flex items-center justify-between mb-2">
          <h2
            class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            {{ $t('diary.progress') }}
          </h2>
          <div class="flex items-center gap-2">
            <div class="inline-flex rounded-lg bg-black/5 dark:bg-white/10 p-0.5">
              <button
                type="button"
                :aria-label="$t('diary.progress-circles')"
                :title="$t('diary.progress-circles')"
                :aria-pressed="progressStyle === 'circles'"
                class="rounded-md p-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                :class="
                  progressStyle === 'circles'
                    ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                "
                @click="setProgressStyle('circles')"
              >
                <LucideCircleGauge class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :aria-label="$t('diary.progress-bars')"
                :title="$t('diary.progress-bars')"
                :aria-pressed="progressStyle === 'bars'"
                class="rounded-md p-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                :class="
                  progressStyle === 'bars'
                    ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                "
                @click="setProgressStyle('bars')"
              >
                <LucideAlignJustify class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <NuxtLink
              :to="$localePath('settings')"
              :aria-label="$t('settings.title')"
              :title="$t('settings.title')"
              class="rounded-md p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              <LucideSettings class="h-4 w-4" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>

        <div v-if="progressStyle === 'circles'" class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-2 max-[400px]:gap-0 sm:justify-center sm:gap-6">
            <template v-if="settings?.maxPhe">
              <ClientOnly>
                <apexchart
                  :key="`phe-${phePercent}-${pheResult}-${circleSize}-${isDark}-${accentColor}`"
                  type="radialBar"
                  :width="circleSize"
                  :height="circleSize"
                  :options="pheCircleOptions"
                  :series="[pheCircleSeries]"
                />
                <template #fallback>
                  <div class="h-22 w-22 sm:h-23 sm:w-23" />
                </template>
              </ClientOnly>
              <div class="min-w-0 sm:w-24">
                <p class="text-sm font-medium leading-tight text-gray-900 dark:text-gray-300">
                  {{ Math.abs(pheRemaining) }} Phe
                </p>
                <p class="text-sm font-medium leading-tight text-gray-500 dark:text-gray-400">
                  {{ pheRemaining < 0 ? $t('app.over') : $t('app.left') }}
                </p>
              </div>
            </template>
            <NuxtLink
              v-else
              class="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
              :to="$localePath('settings')"
              >{{ $t('diary.set-phe') }}</NuxtLink
            >
          </div>
          <div class="flex items-center gap-2 max-[400px]:gap-0 sm:justify-center sm:gap-6">
            <!-- Without a calorie requirement there is no ring, only the total -->
            <ClientOnly v-if="settings?.maxKcal">
              <apexchart
                :key="`kcal-${kcalPercent}-${kcalResult}-${circleSize}-${isDark}-${accentColor}`"
                type="radialBar"
                :width="circleSize"
                :height="circleSize"
                :options="kcalCircleOptions"
                :series="[kcalCircleSeries]"
              />
              <template #fallback>
                <div class="h-22 w-22 sm:h-23 sm:w-23" />
              </template>
            </ClientOnly>
            <div class="min-w-0 sm:w-24">
              <template v-if="settings?.maxKcal">
                <p class="text-sm font-medium leading-tight text-gray-900 dark:text-gray-300">
                  {{ Math.abs(kcalRemaining) }} {{ $t('common.kcal') }}
                </p>
                <p class="text-sm font-medium leading-tight text-gray-500 dark:text-gray-400">
                  {{ kcalRemaining < 0 ? $t('app.over') : $t('app.left') }}
                </p>
              </template>
              <template v-else>
                <p class="text-sm font-medium leading-tight text-gray-900 dark:text-gray-300">
                  {{ kcalResult }} {{ $t('common.kcal') }}
                </p>
                <p class="text-sm font-medium leading-tight text-gray-500 dark:text-gray-400">
                  {{ $t('app.total') }}
                </p>
              </template>
            </div>
          </div>
        </div>

        <!-- Bars view -->
        <div v-else class="py-2">
          <div class="text-sm flex justify-between">
            <span>{{ pheResult }} Phe {{ $t('app.total') }}</span>
            <span v-if="settings?.maxPhe"
              >{{ Math.abs(pheRemaining) }} Phe
              {{ pheRemaining < 0 ? $t('app.over') : $t('app.left') }}</span
            >
            <NuxtLink
              v-if="!settings?.maxPhe"
              class="font-medium text-sky-600 hover:underline dark:text-sky-400"
              :to="$localePath('settings')"
              >{{ $t('diary.set-phe') }}</NuxtLink
            >
          </div>
          <div
            class="relative w-full rounded-full overflow-hidden h-1 mt-2"
            :class="pheBar.over ? 'bg-sky-500' : 'bg-gray-200 dark:bg-gray-700'"
          >
            <div
              class="h-full rounded-full transition-[width] duration-500 ease-out"
              :class="pheBar.over ? 'ml-auto bg-sky-700' : 'bg-sky-500'"
              :style="{ width: `${pheBar.width}%` }"
            />
          </div>
          <div class="text-sm flex justify-between mt-2">
            <span>{{ kcalResult }} {{ $t('common.kcal') }} {{ $t('app.total') }}</span>
            <span v-if="settings?.maxKcal"
              >{{ Math.abs(kcalRemaining) }} {{ $t('common.kcal') }}
              {{ kcalRemaining < 0 ? $t('app.over') : $t('app.left') }}</span
            >
          </div>
          <!-- Without a calorie requirement only the total shows; Settings is one tap away -->
          <div
            v-if="settings?.maxKcal"
            class="relative w-full rounded-full overflow-hidden h-1 mt-2"
            :class="kcalBar.over ? 'bg-sky-500' : 'bg-gray-200 dark:bg-gray-700'"
          >
            <div
              class="h-full rounded-full transition-[width] duration-500 ease-out"
              :class="kcalBar.over ? 'ml-auto bg-sky-700' : 'bg-sky-500'"
              :style="{ width: `${kcalBar.width}%` }"
            />
          </div>
        </div>
      </div>

      <div
        v-if="selectedDayLog.length === 0"
        class="mt-6 mb-6 flex flex-col items-center justify-center py-6 px-4 text-center"
      >
        <component
          :is="selectedGreeting.icon"
          class="h-8 w-8 text-sky-500 dark:text-sky-400 mb-4"
          aria-hidden="true"
        />
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          <template v-if="userName">
            <span class="ph-no-capture">
              {{ $t(selectedGreeting.greeting, { name: userName }) }}
            </span>
          </template>
          <template v-else>
            {{ $t(selectedGreeting.greeting, { name: $t('diary.empty-state.friend') }) }}
          </template>
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          {{ $t(selectedGreeting.message) }}
        </p>
      </div>

      <template v-else>
        <!-- Heading, and the toggle for what the last column and the share bars show -->
        <div class="flex items-center justify-between -mb-3">
          <h2
            class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1"
          >
            {{ $t('diary.log') }}
          </h2>
          <div class="inline-flex rounded-lg bg-black/5 dark:bg-white/10 p-0.5">
            <button
              type="button"
              :aria-pressed="shareMetric === 'phe'"
              class="rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              :class="
                shareMetric === 'phe'
                  ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              "
              @click="shareMetric = 'phe'"
            >
              {{ $t('common.phe') }}
            </button>
            <button
              type="button"
              :aria-pressed="shareMetric === 'kcal'"
              class="rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              :class="
                shareMetric === 'kcal'
                  ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              "
              @click="shareMetric = 'kcal'"
            >
              {{ $t('common.kcal') }}
            </button>
          </div>
        </div>
        <DataTable :headers="tableHeaders" class="mb-6">
          <template v-for="(item, index) in selectedDayLog" :key="index">
            <tr class="cursor-pointer border-b-0" @click="editItem(item, index)">
              <td
                class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6"
              >
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
                    <span
                      v-if="item.note"
                      class="inline-flex items-center align-middle rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                      :title="item.note"
                    >
                      <LucideStickyNote class="h-3.5 w-3.5" />
                    </span>
                  </span>
                </span>
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                {{ item.weight }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                {{ item[shareMetric] }}
              </td>
            </tr>
            <!-- Share of the day's Phe or Kcal across the full row: gray for the rows
                 above, blue for this food; a small share stays a short dash. No dividers,
                 so these lines separate the rows -->
            <tr aria-hidden="true" class="border-b-0">
              <!-- A gap under the last line keeps it off the table's bottom border -->
              <td
                colspan="3"
                class="h-0.5"
                :class="index === selectedDayLog.length - 1 ? 'px-0 pt-0 pb-1.5' : 'p-0'"
              >
                <!-- Rendered once settings have loaded, like the progress bar, so it
                     appears at its final width instead of being scaled to the day's total first -->
                <div v-if="store.settingsLoaded" class="flex h-0.5">
                  <div
                    class="shrink-0 bg-gray-200 dark:bg-gray-700 transition-[width] duration-500 ease-out"
                    :style="{ width: `${shareSegments[index].start}%` }"
                  />
                  <div
                    class="shrink-0 bg-sky-500 transition-[width] duration-500 ease-out"
                    :class="{
                      'rounded-r-full': !shareSegments[index].over,
                      'min-w-1.5': shareSegments[index].under > 0 && !shareSegments[index].over
                    }"
                    :style="{ width: `${shareSegments[index].under}%` }"
                  />
                  <div
                    class="shrink-0 rounded-r-full bg-sky-700 transition-[width] duration-500 ease-out"
                    :class="{
                      'min-w-1.5': shareSegments[index].over > 0 && !shareSegments[index].under
                    }"
                    :style="{ width: `${shareSegments[index].over}%` }"
                  />
                </div>
              </td>
            </tr>
          </template>
        </DataTable>
      </template>

      <ModalDialog
        ref="dialog2"
        :title="formTitle"
        :meta="editedItemTime"
        :emoji="editedItem.emoji || ''"
        :emoji-refreshable="showEmojiAction"
        :emoji-refreshing="isRefreshingEmoji"
        :loading="isSaving"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @refresh-emoji="refreshEmoji"
        @submit="save"
        @delete="deleteItem"
        @close="close"
      >
        <TextInput v-model="editedItem.name" id-name="food" :label="$t('common.food-name')" />
        <div>
          <label
            for="note"
            class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
            >{{ $t('diary.note') }}</label
          >
          <div class="mt-1 mb-3">
            <textarea
              id="note"
              v-model="editedItem.note"
              v-auto-grow
              name="note"
              rows="1"
              :placeholder="$t('diary.note-placeholder')"
              class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
            />
          </div>
        </div>
        <!-- Disclosure: reveals the per-100g reference inputs -->
        <button
          type="button"
          class="mt-4 mb-3 flex w-full cursor-pointer items-center justify-between text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          :aria-expanded="showReferenceInputs"
          @click="showReferenceInputs = !showReferenceInputs"
        >
          {{ $t('common.edit-per-100g') }}
          <LucideChevronDown
            class="h-4 w-4 transition-transform"
            :class="showReferenceInputs ? 'rotate-180' : ''"
          />
        </button>
        <FoodReferenceInputs
          v-if="showReferenceInputs"
          v-model:phe="editedItem.pheReference"
          v-model:kcal="editedItem.kcalReference"
          v-model:nutrients="editedItem.nutrients"
          v-model:factor="editedItem.factor"
        />
        <NumberInput
          v-model.number="editedItem.weight"
          id-name="weight"
          :label="$t('common.consumed-weight')"
        />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>

        <!-- Nutrient breakdown for the entered weight, when the food was saved
             with one. Only the nutrients the entry actually carries are listed. -->
        <div
          v-if="entryNutrientRows.length > 0"
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
        >
          <div v-for="row in entryNutrientRows" :key="row.key" class="flex justify-between">
            <span>{{ row.label }}</span>
            <span>{{ row.value }} g</span>
          </div>
        </div>
      </ModalDialog>

      <div v-if="lastAdded.length !== 0" class="mt-3">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1"
        >
          {{ $t('diary.suggestions') }}
        </h3>
        <div class="flex flex-wrap">
          <SecondaryButton
            v-for="(item, index) in lastAdded.slice(0, visibleItems)"
            :key="index"
            :text="`${item.emoji || '🍽️'} ${item.name}`"
            class="max-w-[calc(50%-0.75rem)] truncate font-normal!"
            @click="addLastAdded(item)"
          />
          <SecondaryButton
            v-if="visibleItems < lastAdded.length"
            :text="$t('diary.more')"
            class="font-normal!"
            @click="showMoreItems"
          />
        </div>
      </div>

      <div v-if="selectedDiaryEntry" class="mt-6 flex items-center">
        <ToggleSwitch
          id="diary-day-incomplete"
          :model-value="!!selectedDiaryEntry.incomplete"
          small
          aria-labelledby="diary-day-incomplete-label"
          @update:model-value="toggleIncomplete"
        />
        <span
          id="diary-day-incomplete-label"
          class="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300 cursor-pointer"
          @click="toggleIncomplete"
        >
          {{ $t('diet-report.day-incomplete') }}
        </span>
      </div>

      <p v-if="!license" class="mt-6 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.diary-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-6 text-sm">
        <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
        {{ isPremiumAI ? $t('app.unlimited-ai') : $t('app.unlimited') }}
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
