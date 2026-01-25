<script setup>
import { useStore } from '../../stores/index'
import foodIcons from '~/assets/data/food-icons-map.json'
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
import { h, ref, computed } from 'vue'
import { valueUpdater } from '@/lib/table-utils'
import DataTableColumnHeader from '@/components/DataTableColumnHeader.vue'
import DataTablePagination from '@/components/DataTablePagination.vue'
import { LucideStickyNote, LucideUsers, LucideThumbsUp, LucideThumbsDown } from 'lucide-vue-next'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const dialog2 = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const confirm = useConfirm()
const { isPremium } = useLicense()
const { saveOwnFood, addFoodItemToDiary, updateOwnFood, deleteOwnFood } = useApi()

// Reactive state
const search = ref('')
const editedIndex = ref(-1)
const editedKey = ref(null)
const weight = ref(100)
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isSaving = ref(false)

const defaultItem = {
  name: '',
  icon: null,
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

const filteredOwnFood = computed(() => {
  if (!search.value.trim()) {
    return ownFood.value
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
      return h('span', { class: 'flex items-center gap-1 min-w-0' }, [
        h('img', {
          src:
            item.icon !== undefined && item.icon !== null && item.icon !== ''
              ? `/images/food-icons/${item.icon}.svg`
              : '/images/food-icons/organic-food.svg',
          width: 25,
          class: 'food-icon flex-shrink-0',
          alt: 'Food Icon',
          onError: (e) => {
            e.target.src = '/images/food-icons/organic-food.svg'
          }
        }),
        h('span', { style: 'word-wrap: break-word; overflow-wrap: break-word;' }, item.name),
        item.shared
          ? h(
              'span',
              {
                class:
                  'inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 ml-2 flex-shrink-0',
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
                  'inline-flex items-center rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 ml-2 flex-shrink-0',
                title: item.note
              },
              [h(LucideStickyNote, { class: 'h-3.5 w-3.5' })]
            )
          : null
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
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    notifications.error(t('app.auth-error'))
    console.error(error)
  }
}

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
            phe: deletedItem.phe,
            kcal: deletedItem.kcal,
            note: deletedItem.note || null,
            shared: false // Don't restore shared status
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

const closeModal = () => {
  dialog.value.closeDialog()
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

  // Check limit before closing (for better UX)
  if (editedIndex.value === -1 && ownFood.value.length >= 50 && !isPremium.value) {
    notifications.error(t('app.limit'))
    return
  }

  // Capture state before closing (needed to determine if editing or adding)
  const isEditing = editedIndex.value > -1
  const entryKey = editedKey.value
  const entryName = editedItem.value.name
  const entryIcon = editedItem.value.icon || null
  const entryPhe = Number(editedItem.value.phe)
  const entryKcal = Number(editedItem.value.kcal) || 0
  const entryNote = editedItem.value.note && editedItem.value.note.trim() !== '' ? editedItem.value.note.trim() : null
  const entryShared = editedItem.value.shared || false

  // Check if unsharing (was shared, now not shared)
  const originalFood = entryKey ? ownFood.value.find((item) => item['.key'] === entryKey) : null
  const wasShared = originalFood?.shared === true
  const isUnsharing = wasShared && !entryShared

  // Close modal first so confirmation dialog appears on top
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

  if (isEditing && entryKey) {
    // Update existing entry - use update API (validates server-side with Zod)
    try {
      await updateOwnFood({
        entryKey: entryKey,
        name: entryName,
        icon: entryIcon,
        phe: entryPhe,
        kcal: entryKcal,
        note: entryNote,
        shared: entryShared
      })
      notifications.success(t('common.saved'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Update error:', error)
    }
  } else {
    // Add new entry - use save API
    try {
      await saveOwnFood({
        name: entryName,
        icon: entryIcon,
        phe: entryPhe,
        kcal: entryKcal,
        note: entryNote,
        shared: entryShared
      })
      notifications.success(t('common.saved'))
    } catch (error) {
      // Error handling is done in useApi composable
      console.error('Save error:', error)
    }
  }
}

const addItem = (item) => {
  weight.value = 100
  editedIndex.value = ownFood.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = { ...item }
  selectedDate.value = format(new Date(), 'yyyy-MM-dd')
  dialog2.value.openDialog()
}

const calculatePhe = () => {
  return Math.round((weight.value * editedItem.value.phe) / 100)
}

const calculateKcal = () => {
  return Math.round((weight.value * editedItem.value.kcal) / 100) || 0
}

const add = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  const logEntry = {
    name: editedItem.value.name,
    icon: editedItem.value.icon || null,
    emoji: null,
    pheReference: editedItem.value.phe,
    kcalReference: editedItem.value.kcal || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note: editedItem.value.note && editedItem.value.note.trim() !== '' ? editedItem.value.note.trim() : null
  }

  isSaving.value = true

  // Use server API for all writes - validates with Zod
  try {
    await addFoodItemToDiary({
      date: selectedDate.value,
      ...logEntry
    })
    notifications.success(t('common.saved'))
    dialog2.value.closeDialog()
    navigateTo(localePath('diary'))
  } catch (error) {
    // Error handling is done in useApi composable
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
        [escapeCSV(entry.name), escapeCSV(entry.phe), escapeCSV(entry.kcal), escapeCSV(entry.note || '')].join(',') + '\n'
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

const setIcon = (item, close) => {
  editedItem.value.icon = item.svg
  close()
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

defineOgImageComponent('NuxtSeo', {
  title: () => t('own-food.title') + ' - PKU Tools',
  description: () => t('own-food.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('own-food.title')" />
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
          />
        </div>
      </div>

      <div class="mb-8">
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div
                class="overflow-hidden shadow-sm ring-1 ring-gray-300 dark:ring-gray-800 ring-opacity-5 sm:rounded-lg"
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
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
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
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="save"
        @delete="deleteItem"
        @close="closeModal"
      >
        <HeadlessPopover v-if="license">
          <HeadlessPopoverButton class="my-1">
            <img
              v-if="editedItem.icon !== undefined && editedItem.icon !== null"
              :src="'/images/food-icons/' + editedItem.icon + '.svg'"
              width="30"
              class="food-icon float-left"
              alt="Food Icon"
            />
            <img
              v-if="editedItem.icon === undefined || editedItem.icon === null"
              :src="'/images/food-icons/organic-food.svg'"
              width="30"
              class="food-icon float-left"
              alt="Food Icon"
            />
            <span class="float-left my-1 ml-2 text-sm">{{ $t('own-food.choose-icon') }}</span>
            <LucideChevronDown class="h-5 w-5 inline-block ml-2" aria-hidden="true" />
          </HeadlessPopoverButton>

          <transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <HeadlessPopoverPanel v-slot="{ close }">
              <span v-for="(item, index) in foodIcons" :key="index">
                <img
                  v-if="item.svg !== undefined"
                  :src="'/images/food-icons/' + item.svg + '.svg'"
                  width="35"
                  class="food-icon pick-icon m-2"
                  alt="Food Icon"
                  @click="setIcon(item, close)"
                />
              </span>
            </HeadlessPopoverPanel>
          </transition>
        </HeadlessPopover>

        <TextInput
          v-model="editedItem.name"
          id-name="food"
          :label="$t('common.food-name')"
          class="mt-2"
        />
        <div class="flex gap-4">
          <NumberInput
            v-model.number="editedItem.phe"
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            class="flex-1"
          />
          <NumberInput
            v-model.number="editedItem.kcal"
            id-name="kcal"
            :label="$t('common.kcal-per-100g')"
            class="flex-1"
          />
        </div>
        <div class="mt-3">
          <label
            for="note"
            class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
            >{{ $t('diary.note') }}</label
          >
          <div class="mt-1 mb-3">
            <textarea
              id="note"
              v-model="editedItem.note"
              name="note"
              rows="3"
              :placeholder="$t('diary.note-placeholder')"
              class="block w-full rounded-md border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
            />
          </div>
        </div>

        <!-- Share with community -->
        <div class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div class="flex items-start">
            <div class="flex h-6 items-center">
              <input
                id="shared"
                v-model="editedItem.shared"
                name="shared"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-600 dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div class="ml-3 text-sm leading-6">
              <label for="shared" class="font-medium text-gray-900 dark:text-gray-300">
                {{ $t('community.share') }}
              </label>
              <p class="text-gray-500 dark:text-gray-400">
                {{ $t('community.shareLanguage', { language: $t('app.language-name') }) }}
              </p>
            </div>
          </div>

          <!-- Vote counts for shared foods -->
          <div
            v-if="editedItem.shared && editedCommunityFood"
            class="mt-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400"
          >
            <span class="flex items-center gap-1">
              <LucideThumbsUp class="h-4 w-4 text-emerald-600" />
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
        {{ $t('app.unlimited') }}
      </p>

      <ModalDialog
        ref="dialog2"
        :title="editedItem.name"
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

        <!-- Community metrics for shared foods -->
        <div
          v-if="editedItem.shared && editedCommunityFood"
          class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400"
        >
          <span class="flex items-center gap-1">
            <LucideThumbsUp class="h-4 w-4 text-emerald-600" />
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
