<script setup>
import { useStore } from '../../stores/index'
import Fuse from 'fuse.js'
import { format } from 'date-fns'
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable
} from '@tanstack/vue-table'
import { h, ref, computed, watch, onMounted } from 'vue'
import { valueUpdater } from '@/lib/table-utils'
import DataTableColumnHeader from '@/components/DataTableColumnHeader.vue'
import DataTablePagination from '@/components/DataTablePagination.vue'
import { LucideStickyNote, LucideUsers, LucideThumbsUp, LucideThumbsDown } from '@lucide/vue'
import {
  scaleToWeight,
  nutrientRows,
  isReported,
  pheContradictsConversion,
  foodTypeForFactor,
  pheFactor,
  proteinPheReference
} from '../utils/nutrition'
import { isShareableSource } from '../utils/community-food'
import { foodSourceLabel } from '../utils/food-source-label'
import { hasMaterialFoodChange } from '#shared/utils/material-food'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const dialog2 = ref(null)
const route = useRoute()
const localePath = useLocalePath()
const router = useRouter()
const notifications = useNotifications()
const confirm = useConfirm()
const { isPremium, isPremiumAI } = useLicense()
const { saveOwnFood, addFoodItemToDiary, updateOwnFood, deleteOwnFood } = useApi()
const { fetchEmojiForFood, ensureEmojiForLogEntry } = useFoodEmoji()
const { confirmFoodType } = useFoodTypeSuggestion()

// Reactive state
const search = ref('')
const editedIndex = ref(-1)
const editedKey = ref(null)
const weight = ref(100)
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isSaving = ref(false)
const isGeneratingEmoji = ref(false)
// The food name the current emoji was generated for; when the name is edited
// away from this, an update button offers to regenerate the emoji
const emojiBasisName = ref('')
// Premium users may replace an emoji they don't like once per opened dialog,
// without having to change the food name
const hasRerolledIcon = ref(false)

const defaultItem = {
  name: '',
  icon: null,
  emoji: null,
  phe: null,
  kcal: null,
  note: null,
  shared: false,
  communityKey: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const ownFood = computed(() => store.ownFood)
const communityFoods = computed(() => store.communityFoods)

const license = computed(() => isPremium.value)

// Get community food data for the currently edited item
const editedCommunityFood = computed(() => {
  if (!editedItem.value.communityKey) return null
  return communityFoods.value.find((f) => f['.key'] === editedItem.value.communityKey) || null
})

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

// An AI estimate is a guess, so a new share is never offered for it. A legacy
// record that is already shared still needs the control so it can be withdrawn.
const canShareEditedItem = computed(() => isShareableSource(editedItem.value.source))
const wasEditedItemShared = computed(() => {
  if (!editedKey.value) return false
  return ownFood.value.find((item) => item['.key'] === editedKey.value)?.shared === true
})

// Offer the icon update once the name is edited away from what the current
// emoji represents (only when there is an emoji to replace)
const showIconUpdate = computed(() => {
  const name = editedItem.value.name?.trim()
  return !!editedItem.value.emoji && !!name && name !== emojiBasisName.value.trim()
})

// Premium extra: one replacement per opened dialog for an emoji that fits the
// name but isn't wanted. Free users get a new emoji by editing the name, except
// on a published food — its icon is shown to every community user, and renaming
// is a material change that would reset the food's votes. The published state is
// the stored one, so toggling the share switch is not a way around the gate.
const canRerollIcon = computed(
  () =>
    (isPremium.value || wasEditedItemShared.value) &&
    !!editedItem.value.emoji &&
    !hasRerolledIcon.value
)

// The dialog corner offers the icon action: generate one for an entry that has
// none (legacy or a failed generation), update it after a name change, or
// spend the reroll
const showIconAction = computed(() => {
  if (editedIndex.value === -1 || !editedItem.value.name?.trim()) return false
  return !editedItem.value.emoji || showIconUpdate.value || canRerollIcon.value
})

const filteredOwnFood = computed(() => {
  if (!search.value.trim()) {
    // Entries have no date field, but Firebase push keys are chronological,
    // so key-descending shows the newest foods first
    return [...ownFood.value].sort((a, b) => (a['.key'] < b['.key'] ? 1 : -1))
  }

  const fuse = new Fuse(ownFood.value, {
    keys: ['name', 'phe', 'note'],
    threshold: 0.2,
    minMatchCharLength: 2,
    ignoreLocation: true,
    useExtendedSearch: true
  })

  const results = fuse.search(search.value.trim())
  return results.map((result) => result.item)
})

// Table state
const sorting = ref([])
const columnFilters = ref([])
const columnVisibility = ref({})

// Column definitions
const columns = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return h(DataTableColumnHeader, {
        column: column,
        title: t('common.food')
      })
    },
    cell: ({ row }) => {
      const item = row.original
      const hasEmoji = item.emoji != null && item.emoji !== ''
      const hasIcon = item.icon != null && item.icon !== ''
      const iconOrEmoji = hasEmoji
        ? h(
            'span',
            { class: 'text-xl flex-shrink-0 inline-block align-middle leading-none' },
            item.emoji
          )
        : hasIcon
          ? h('img', {
              src: `/images/food-icons/${item.icon}.svg`,
              width: 25,
              class: 'food-icon flex-shrink-0',
              alt: 'Food Icon',
              onError: (e) => {
                e.target.src = '/images/food-icons/organic-food.svg'
              }
            })
          : h(
              'span',
              { class: 'text-xl flex-shrink-0 opacity-50 inline-block align-middle leading-none' },
              '🍽'
            )
      // Name and badges share one inline block, so badges wrap with the text
      return h('span', { class: 'flex items-center gap-1 min-w-0' }, [
        iconOrEmoji,
        h('span', { class: 'wrap-anywhere' }, [
          item.name,
          item.shared
            ? h(
                'span',
                {
                  class:
                    'inline-flex items-center align-middle rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 ml-1',
                  title: t('community.shared')
                },
                [h(LucideUsers, { class: 'h-3.5 w-3.5' })]
              )
            : null,
          item.note
            ? h(
                'span',
                {
                  class:
                    'inline-flex items-center align-middle rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 ml-1',
                  title: item.note
                },
                [h(LucideStickyNote, { class: 'h-3.5 w-3.5' })]
              )
            : null
        ])
      ])
    }
  },
  {
    accessorKey: 'phe',
    header: ({ column }) => {
      return h(DataTableColumnHeader, {
        column: column,
        title: t('common.phe')
      })
    },
    cell: ({ row }) => {
      return h('div', row.getValue('phe'))
    }
  },
  {
    accessorKey: 'kcal',
    header: ({ column }) => {
      return h(DataTableColumnHeader, {
        column: column,
        title: t('common.kcal')
      })
    },
    cell: ({ row }) => {
      return h('div', row.getValue('kcal'))
    }
  }
]

// Table instance
const table = useVueTable({
  data: filteredOwnFood,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: {
      pageSize: 20
    }
  },
  onSortingChange: (updaterOrValue) => valueUpdater(updaterOrValue, sorting),
  onColumnFiltersChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnFilters),
  onColumnVisibilityChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnVisibility),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get columnVisibility() {
      return columnVisibility.value
    }
  }
})

// Methods

const editItem = () => {
  dialog2.value.closeDialog()
  dialog.value.openDialog()
}

const deleteItem = async () => {
  // Capture values before closing (needed for API call and undo)
  const entryKey = editedKey.value
  const deletedItem = JSON.parse(
    JSON.stringify(ownFood.value.find((item) => item['.key'] === entryKey))
  )

  // Close modal first so confirmation dialog appears on top
  closeModal()

  // If shared, show warning and ask for confirmation
  if (deletedItem.shared) {
    const confirmed = await confirm.confirm({
      title: t('own-food.delete-shared-title'),
      message: t('own-food.delete-shared-warning'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      variant: 'destructive'
    })

    if (!confirmed) {
      return
    }
  }

  try {
    await deleteOwnFood({
      entryKey: entryKey
    })

    notifications.success(t('own-food.item-deleted'), {
      undoAction: async () => {
        try {
          // Restore the item by adding it back via save API
          // Note: shared status is not restored as community food was already deleted
          await saveOwnFood({
            name: deletedItem.name,
            icon: deletedItem.icon || null,
            emoji: deletedItem.emoji || null,
            phe: deletedItem.phe,
            kcal: deletedItem.kcal,
            note: deletedItem.note || null,
            shared: false, // Don't restore shared status
            createdAt: deletedItem.createdAt,
            updatedAt: deletedItem.updatedAt,
            // Provenance has to travel with the restore: it decides later
            // whether the food may be shared, and cannot be reconstructed
            nutrients: deletedItem.nutrients || null,
            factor: deletedItem.factor ?? null,
            source: deletedItem.source || null,
            sourceId: deletedItem.sourceId || null,
            ...(deletedItem.materiallyEdited === true && { materiallyEdited: true })
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

// Invalidates a save when the user dismisses its edit dialog.
let dismissals = 0

const dismissModal = () => {
  dismissals += 1
  closeModal()
}

const closeModal = () => {
  dialog.value?.closeDialog()
  dialog2.value?.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
  emojiBasisName.value = ''
  hasRerolledIcon.value = false
  if (route.query.edit) {
    router.replace({ path: route.path, query: {} })
  }
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Check limit before closing (for better UX). Shared foods don't count
  // towards the limit, so the count has to match the server's or the dialog
  // refuses saves the API would accept.
  if (editedIndex.value === -1 && !isPremium.value) {
    const nonSharedCount = ownFood.value.filter((item) => !item.shared).length
    if (nonSharedCount >= 50) {
      notifications.error(t('app.limit'))
      return
    }
  }

  // Capture state before closing (needed to determine if editing or adding)
  const isEditing = editedIndex.value > -1
  const entryKey = editedKey.value
  const entryName = editedItem.value.name
  const entryEmoji = editedItem.value.emoji || null
  const entryIcon = editedItem.value.icon || null
  let entryPhe = Number(editedItem.value.phe)
  const entryKcal = Number(editedItem.value.kcal) || 0
  // Conversion metadata travels with derived Phe.
  const entryNutrients = editedItem.value.nutrients ?? null
  let entryFactor = editedItem.value.factor ?? null
  const entryNote =
    editedItem.value.note && editedItem.value.note.trim() !== ''
      ? editedItem.value.note.trim()
      : null
  const entryShared = editedItem.value.shared || false

  // Check converted foods before calculating material changes.
  const chosenType = foodTypeForFactor(entryFactor)
  if (chosenType && isReported(entryNutrients?.protein)) {
    const dismissalsWhenAsked = dismissals
    isSaving.value = true
    try {
      const correctedType = await confirmFoodType(
        entryName,
        chosenType,
        (foodType) => proteinPheReference(entryNutrients.protein, foodType),
        () => dismissals === dismissalsWhenAsked
      )
      if (dismissals !== dismissalsWhenAsked) return
      if (correctedType === null) return
      if (correctedType !== chosenType) {
        entryFactor = pheFactor(correctedType)
        entryPhe = proteinPheReference(entryNutrients.protein, correctedType)
        // Keep a failed save on the correction the user accepted.
        editedItem.value.factor = entryFactor
        editedItem.value.phe = entryPhe
      }
    } finally {
      isSaving.value = false
    }
  }

  // Check if unsharing (was shared, now not shared)
  const originalFood = entryKey ? ownFood.value.find((item) => item['.key'] === entryKey) : null
  const wasShared = originalFood?.shared === true
  const isUnsharing = wasShared && !entryShared

  // Name and nutritional content are the identity people endorse in Community.
  // The server repeats this comparison and derives the persistent edit flag;
  // this client copy is only for the pre-save vote-reset warning.
  const materialChange =
    !!originalFood &&
    hasMaterialFoodChange(originalFood, {
      name: entryName,
      phe: entryPhe,
      kcal: entryKcal,
      nutrients: entryNutrients,
      factor: entryFactor
    })

  // Check if name, phe or kcal changed on a shared food (will reset votes)
  const willResetVotes = wasShared && entryShared && materialChange

  // Confirmation flows close the modal first so the confirmation dialog
  // appears on top. Otherwise the modal stays open during the save so API
  // errors (e.g. duplicate food) show inline and the input is preserved.
  if (isUnsharing || willResetVotes) {
    closeModal()

    // If unsharing, show warning
    if (isUnsharing) {
      const confirmed = await confirm.confirm({
        title: t('own-food.unshare-title'),
        message: t('own-food.unshare-warning'),
        confirmLabel: t('own-food.unshare-confirm'),
        cancelLabel: t('common.cancel'),
        variant: 'destructive'
      })

      if (!confirmed) {
        return
      }
    }

    // If phe/kcal changed on shared food, warn that votes will be reset
    if (willResetVotes) {
      const confirmed = await confirm.confirm({
        title: t('own-food.reset-votes-title'),
        message: t('own-food.reset-votes-warning'),
        confirmLabel: t('common.save'),
        cancelLabel: t('common.cancel'),
        variant: 'default'
      })

      if (!confirmed) {
        return
      }
    }
  }

  isSaving.value = true
  try {
    if (isEditing && entryKey) {
      // Update existing entry - use update API (validates server-side with Zod)
      await updateOwnFood({
        entryKey: entryKey,
        name: entryName,
        icon: entryIcon,
        emoji: entryEmoji,
        phe: entryPhe,
        kcal: entryKcal,
        note: entryNote,
        shared: entryShared,
        nutrients: entryNutrients,
        factor: entryFactor
      })
    } else {
      // Add new entry - auto-generate emoji if missing, then save
      let emoji = entryEmoji
      if (!emoji && entryName.trim()) {
        const withEmoji = await ensureEmojiForLogEntry({
          name: entryName,
          emoji: null,
          icon: null
        })
        emoji = withEmoji.emoji || null
      }
      await saveOwnFood({
        name: entryName,
        icon: null,
        emoji,
        phe: entryPhe,
        kcal: entryKcal,
        note: entryNote,
        shared: entryShared,
        source: 'manual'
      })
    }
    notifications.success(t('common.saved'))
    closeModal()
  } catch (error) {
    // The dialog stays open so the inline error is visible and the input can be
    // corrected
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
}

const addItem = (item) => {
  weight.value = 100
  editedIndex.value = ownFood.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = { ...item }
  emojiBasisName.value = editedItem.value.name || ''
  hasRerolledIcon.value = false
  selectedDate.value = format(new Date(), 'yyyy-MM-dd')
  dialog2.value.openDialog()
}

// Open edit dialog for an entry by key (e.g. from food-search "Share with community")
const openEditDialogForEntryKey = (entryKey) => {
  const item = ownFood.value.find((f) => f['.key'] === entryKey)
  if (!item || !dialog.value) return false
  editedIndex.value = ownFood.value.indexOf(item)
  editedKey.value = entryKey
  editedItem.value = { ...item }
  emojiBasisName.value = editedItem.value.name || ''
  hasRerolledIcon.value = false
  dialog.value.openDialog()
  return true
}

// Pending ?edit=KEY from URL (set on mount, consumed when ownFood is ready)
const pendingEditKey = ref(null)
onMounted(() => {
  const editKey = route.query.edit
  if (editKey && typeof editKey === 'string') pendingEditKey.value = editKey
})

// When we have a pending edit key and ownFood has loaded, open the edit dialog
watch(
  () => [pendingEditKey.value, ownFood.value.length],
  ([key, len]) => {
    if (!key || len === 0) return
    const opened = openEditDialogForEntryKey(key)
    pendingEditKey.value = null
    if (!opened && route.query.edit) {
      router.replace({ path: route.path, query: {} })
    }
  },
  { immediate: true }
)

const calculatePhe = () => scaleToWeight(Number(editedItem.value.phe), weight.value)

const calculateKcal = () => scaleToWeight(Number(editedItem.value.kcal), weight.value)

// Own foods saved from the scanners and the calculators carry the nutrients
// their source reported. They render here exactly as they do in food search and
// in the tool the food came from, scaled to the weight being added.
const ownFoodNutrientRows = computed(() =>
  nutrientRows(editedItem.value.nutrients, weight.value, t)
)

// Own Food holds hand-entered values next to scanned products, read labels and
// AI estimates, and months later they look alike. The origin is what separates
// a printed value from a guess — and it is the same sentence food search shows
// for the same food.
// Surface inconsistent conversions even while the edit fields are collapsed.
const editedItemContradictsConversion = computed(() =>
  pheContradictsConversion(
    editedItem.value.phe,
    editedItem.value.nutrients?.protein,
    editedItem.value.factor
  )
)

const editedItemSourceLabel = computed(() => foodSourceLabel(editedItem.value, t))

const add = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  let logEntry = {
    name: editedItem.value.name,
    icon: editedItem.value.icon || null,
    emoji: editedItem.value.emoji || null,
    pheReference: editedItem.value.phe,
    kcalReference: editedItem.value.kcal || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note:
      editedItem.value.note && editedItem.value.note.trim() !== ''
        ? editedItem.value.note.trim()
        : null,
    // The entry keeps where the food's values came from — a barcode, a label, a
    // hand-entered number — and records separately that it was added from here.
    // Legacy foods have no stored origin, which stays null rather than becoming
    // a claim.
    source: editedItem.value.source || null,
    addedFrom: 'own-food',
    nutrients: editedItem.value.nutrients || null,
    factor: editedItem.value.factor ?? null,
    sourceId: editedItem.value.sourceId || null,
    ...(editedItem.value.materiallyEdited === true && { materiallyEdited: true })
  }

  isSaving.value = true

  // Use server API for all writes - validates with Zod
  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

    await addFoodItemToDiary({
      date: selectedDate.value,
      ...logEntry,
      // Pass communityFoodKey to track usage count (will be stored in diary entry)
      communityFoodKey:
        editedItem.value.shared && editedItem.value.communityKey
          ? editedItem.value.communityKey
          : undefined
    })
    notifications.success(t('common.saved'))
    dialog2.value.closeDialog()
    navigateTo(localePath('diary'))
  } catch (error) {
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
}

const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  return `"${value.toString().replace(/"/g, '""')}"`
}

const exportOwnFood = async () => {
  const r = await confirm.confirm({
    title: t('common.export'),
    message: t('common.export-description'),
    confirmLabel: t('common.export'),
    cancelLabel: t('common.cancel'),
    variant: 'default'
  })
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Name,Phe per 100g,Kcal per 100g,Note\n'

    ownFood.value.forEach((entry) => {
      const row =
        [
          escapeCSV(entry.name),
          escapeCSV(entry.phe),
          escapeCSV(entry.kcal),
          escapeCSV(entry.note || '')
        ].join(',') + '\n'
      csvContent += row
    })
    triggerDownload(csvContent)
  }
}

const triggerDownload = (csvContent) => {
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', t('own-food.export-filename') + '.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const generateIcon = async () => {
  const name = editedItem.value.name?.trim()
  if (!name) return

  // Same name plus an existing emoji means the user wants a different emoji for
  // the same food — the premium reroll. The button is hidden when that isn't
  // allowed, so this only guards against a stale click.
  const isReroll = !!editedItem.value.emoji && name === emojiBasisName.value.trim()
  if (isReroll && !canRerollIcon.value) return
  const previousEmoji = isReroll ? editedItem.value.emoji : null

  isGeneratingEmoji.value = true
  try {
    const emoji = await fetchEmojiForFood(name, previousEmoji)
    if (emoji && emoji !== previousEmoji) {
      editedItem.value.emoji = emoji
      editedItem.value.icon = null
      // Advance the basis so the update button hides until the name is edited
      // again; on a failed fetch it stays so the user can retry
      emojiBasisName.value = name
      if (isReroll) hasRerolledIcon.value = true
    } else {
      // Surface the failure so the user isn't left re-clicking a silent button.
      // A reroll that came back with the same emoji isn't spent, so the retry
      // this message offers is actually available.
      notifications.error(t('errors.emoji-update-failed'))
    }
  } finally {
    isGeneratingEmoji.value = false
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/own-food',
      de: '/eigene-lebensmittel',
      es: '/alimentos-propios',
      fr: '/aliments-personnels'
    }
  }
})

useSeoMeta({
  title: () => t('own-food.title'),
  description: () => t('own-food.description')
})

defineOgImage('Default', {
  title: () => t('own-food.title') + ' - PKU Tools',
  description: () => t('own-food.description')
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('own-food.title')" />
    </header>

    <div v-if="!userIsAuthenticated">
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ $t('own-food.description') }}</p>
      <NuxtLink
        type="button"
        :to="$localePath('sign-in')"
        class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 mr-3 mb-6"
      >
        {{ $t('sign-in.title') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
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
          />
        </div>
      </div>

      <!-- Point contributors to the edit form where converted food types can be checked. -->
      <p
        class="mb-6 rounded-lg bg-sky-50 p-3 text-sm text-gray-700 dark:bg-sky-950/50 dark:text-gray-300"
      >
        {{ $t('own-food.type-check-notice', { action: $t('common.edit') }) }}
      </p>

      <div class="mb-8">
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div
                class="overflow-hidden shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 sm:rounded-xl"
              >
                <table class="w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead class="bg-gray-50 dark:bg-gray-950">
                    <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                      <th
                        v-for="(header, index) in headerGroup.headers"
                        :key="header.id"
                        :class="[
                          'py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-300',
                          index === 0 ? 'pl-4 pr-3 sm:pl-6' : 'px-3 whitespace-nowrap'
                        ]"
                      >
                        <FlexRender
                          v-if="!header.isPlaceholder"
                          :render="header.column.columnDef.header"
                          :props="header.getContext()"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900"
                  >
                    <template v-if="table.getRowModel().rows?.length">
                      <tr
                        v-for="row in table.getRowModel().rows"
                        :key="row.id"
                        class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        @click="addItem(row.original)"
                      >
                        <td
                          v-for="cell in row.getVisibleCells()"
                          :key="cell.id"
                          :class="[
                            'py-4 text-sm',
                            cell.column.id === 'name'
                              ? 'pl-4 pr-3 sm:pl-6 font-medium text-gray-900 dark:text-gray-300'
                              : 'px-3 font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap'
                          ]"
                        >
                          <FlexRender
                            :render="cell.column.columnDef.cell"
                            :props="cell.getContext()"
                          />
                        </td>
                      </tr>
                    </template>
                    <tr v-else>
                      <td
                        :colspan="columns.length"
                        class="h-24 text-center text-gray-500 dark:text-gray-400"
                      >
                        {{ $t('common.no-entries') }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <DataTablePagination :table="table" />
      </div>

      <PrimaryButton :text="$t('common.add')" @click="$refs.dialog.openDialog()" />

      <ModalDialog
        ref="dialog"
        :title="formTitle"
        :emoji="editedIndex > -1 ? editedItem.emoji || '🍽' : ''"
        :emoji-refreshable="showIconAction"
        :emoji-refreshing="isGeneratingEmoji"
        :loading="isSaving"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @refresh-emoji="generateIcon"
        @submit="save"
        @delete="deleteItem"
        @close="dismissModal"
      >
        <fieldset :disabled="isSaving" class="m-0 min-w-0 border-0 p-0">
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
          <FoodReferenceInputs
            v-model:phe="editedItem.phe"
            v-model:kcal="editedItem.kcal"
            v-model:nutrients="editedItem.nutrients"
            v-model:factor="editedItem.factor"
          />
          <!-- Share with community -->
          <div
            v-if="canShareEditedItem || wasEditedItemShared"
            class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4"
          >
            <div class="flex items-start">
              <div class="flex h-6 items-center">
                <input
                  id="shared"
                  v-model="editedItem.shared"
                  name="shared"
                  type="checkbox"
                  :disabled="!canShareEditedItem && !editedItem.shared"
                  class="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-600 dark:border-gray-600 dark:bg-gray-800"
                />
              </div>
              <div class="ml-3 text-sm leading-6">
                <label for="shared" class="font-medium text-gray-900 dark:text-gray-300">
                  {{ $t('community.share') }}
                </label>
                <p v-if="canShareEditedItem" class="text-gray-500 dark:text-gray-400">
                  {{ $t('community.shareLanguage', { language: $t('app.language-name') }) }}
                </p>
                <p v-else class="text-gray-500 dark:text-gray-400">
                  {{ $t('community.notShareable') }}
                </p>
              </div>
            </div>

            <!-- Vote counts for shared foods -->
            <div
              v-if="editedItem.shared && editedCommunityFood"
              class="mt-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400"
            >
              <span class="font-medium">{{ $t('community.statistics') }}</span>
              <span class="flex items-center gap-1">
                <LucideThumbsUp class="h-4 w-4 text-teal-600" />
                {{ editedCommunityFood.likes || 0 }}
              </span>
              <span class="flex items-center gap-1">
                <LucideThumbsDown class="h-4 w-4 text-red-500" />
                {{ editedCommunityFood.dislikes || 0 }}
              </span>
              <span class="text-gray-400">
                {{ $t('community.usageCount', { count: editedCommunityFood.usageCount || 0 }) }}
              </span>
            </div>
          </div>

          <!-- Why the option above is missing for this food -->
          <p
            v-else
            class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 text-sm text-gray-500 dark:text-gray-400"
          >
            {{ $t('community.notShareable') }}
          </p>
        </fieldset>
      </ModalDialog>

      <SecondaryButton v-if="license" :text="$t('common.export')" @click="exportOwnFood" />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.own-food-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-3 text-sm">
        <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
        {{ isPremiumAI ? $t('app.unlimited-ai') : $t('app.unlimited') }}
      </p>

      <ModalDialog
        ref="dialog2"
        :title="editedItem.emoji ? editedItem.emoji + ' ' + editedItem.name : editedItem.name"
        :loading="isSaving"
        :buttons="[
          { label: $t('common.add'), type: 'submit', visible: true },
          { label: $t('common.edit'), type: 'edit', visible: true },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="add"
        @edit="editItem"
        @close="closeModal"
      >
        <DateInput
          v-if="userIsAuthenticated"
          v-model="selectedDate"
          id-name="date"
          :label="$t('common.date')"
        />
        <NumberInput v-model.number="weight" id-name="weight" :label="$t('common.weight-in-g')" />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>

        <!-- Nutrient breakdown for the entered weight, for the foods that carry
             one. Same grid as food search and the tools the food came from. -->
        <div
          v-if="ownFoodNutrientRows.length > 0"
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
        >
          <div v-for="row in ownFoodNutrientRows" :key="row.key" class="flex justify-between">
            <span>{{ row.label }}</span>
            <span>{{ row.value }} g</span>
          </div>
        </div>

        <!-- Where these values came from, worded as in food search -->
        <p v-if="editedItemSourceLabel" class="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {{ $t('food-search.value-source', { source: editedItemSourceLabel }) }}
        </p>

        <!-- What the edit form can settle about this food, told rather than
             offered: this dialog logs a portion, it does not change the food -->
        <p
          v-if="editedItemContradictsConversion"
          class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-gray-700 dark:bg-amber-950/40 dark:text-gray-300"
        >
          {{ $t('common.phe-mismatch-short', { action: $t('common.edit') }) }}
        </p>
        <p
          v-if="!editedItem.shared && canShareEditedItem"
          class="mt-3 text-sm text-gray-500 dark:text-gray-400"
        >
          {{ $t('own-food.share-hint', { action: $t('common.edit') }) }}
        </p>

        <!-- Community metrics for shared foods -->
        <div
          v-if="editedItem.shared && editedCommunityFood"
          class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400"
        >
          <span class="font-medium">{{ $t('community.statistics') }}</span>
          <span class="flex items-center gap-1">
            <LucideThumbsUp class="h-4 w-4 text-teal-600" />
            {{ editedCommunityFood.likes || 0 }}
          </span>
          <span class="flex items-center gap-1">
            <LucideThumbsDown class="h-4 w-4 text-red-500" />
            {{ editedCommunityFood.dislikes || 0 }}
          </span>
          <span class="text-gray-400">
            {{ $t('community.usageCount', { count: editedCommunityFood.usageCount || 0 }) }}
          </span>
        </div>
      </ModalDialog>
    </div>
  </div>
</template>

<style scoped>
.food-icon {
  vertical-align: bottom;
  display: inline-block;
}

.pick-icon {
  cursor: pointer;
}
</style>
