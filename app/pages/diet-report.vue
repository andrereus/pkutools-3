<script setup>
import { useStore } from '../../stores/index'
import { format, parseISO, formatISO, subMonths, subWeeks } from 'date-fns'
import { enUS, de, fr, es } from 'date-fns/locale'
import enChart from 'apexcharts/dist/locales/en.json'
import deChart from 'apexcharts/dist/locales/de.json'
import frChart from 'apexcharts/dist/locales/fr.json'
import esChart from 'apexcharts/dist/locales/es.json'
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

const store = useStore()
const { t, locale: i18nLocale } = useI18n()
const dialog = ref(null)
const dialog2 = ref(null)
const notifications = useNotifications()
const confirm = useConfirm()
const { isPremium } = useLicense()
const { addFoodItemToDiary, deleteDiaryDay, updateDiaryDay, createDiaryDay } = useApi()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)

const defaultItem = {
  date: format(new Date(), 'yyyy-MM-dd'),
  phe: null,
  kcal: null
}

const editedItem = ref({ ...defaultItem })

const selection = ref('all')
const chartRef = ref(null)

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const pheDiary = computed(() => store.pheDiary)
const settings = computed(() => store.settings)

const license = computed(() => isPremium.value)

const getlocalDate = (date) => {
  if (date) {
    const locales = { enUS, de, fr, es }
    return format(parseISO(date), 'eee P', { locale: locales[i18nLocale.value] })
  } else {
    return ''
  }
}

// Table state
const sorting = ref([])
const columnFilters = ref([])
const columnVisibility = ref({})

// Column definitions
const columns = [
  {
    accessorKey: 'date',
    header: ({ column }) => {
      return h(DataTableColumnHeader, {
        column: column,
        title: t('diet-report.date')
      })
    },
    cell: ({ row }) => {
      return h('div', getlocalDate(row.original.date))
    },
    sortingFn: (rowA, rowB) => {
      const dateA = parseISO(rowA.original.date)
      const dateB = parseISO(rowB.original.date)
      return dateA.getTime() - dateB.getTime()
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
    },
    sortingFn: (rowA, rowB) => {
      const pheA = rowA.original.phe ?? 0
      const pheB = rowB.original.phe ?? 0
      return pheA - pheB
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
    },
    sortingFn: (rowA, rowB) => {
      const kcalA = rowA.original.kcal ?? 0
      const kcalB = rowB.original.kcal ?? 0
      return kcalA - kcalB
    }
  }
]

// Table instance
const table = useVueTable({
  data: pheDiary,
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

const tableHeaders2 = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const graph = computed(() => {
  const newPheDiary = pheDiary.value
  const chartPheDiary = newPheDiary
    .map((obj) => {
      return { x: obj.date, y: obj.phe }
    })
    .sort((a, b) => {
      return parseISO(a.x) - parseISO(b.x)
    })
  return [
    {
      name: 'Phe',
      data: chartPheDiary
    }
  ]
})

const chartOptions = computed(() => {
  const en = enChart
  const de = deChart
  const fr = frChart
  const es = esChart
  return {
    chart: {
      locales: [en, de, fr, es],
      defaultLocale: i18nLocale.value,
      toolbar: {
        tools: {
          zoom: false,
          zoomin: false,
          zoomout: false,
          reset: false
        },
        export: {
          csv: {
            filename: 'PKU Tools - Chart Data',
            headerCategory: 'Date',
            headerValue: 'Total Phe',
            dateFormatter(timestamp) {
              return timestamp
            }
          },
          svg: {
            filename: 'PKU Tools - Chart'
          },
          png: {
            filename: 'PKU Tools - Chart'
          }
        },
        autoSelected: 'pan'
      },
      zoom: {
        enabled: true
      },
      background: 'transparent'
    },
    stroke: {
      curve: 'smooth'
    },
    markers: {
      size: 1
    },
    grid: {
      show: false
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      type: 'datetime'
    },
    yaxis: {
      min: 0
    },
    annotations: {
      yaxis: [
        {
          y: settings.value.maxPhe || 0,
          borderWidth: 2,
          borderColor: '#3498db',
          strokeDashArray: 6
        }
      ]
    },
    theme: {
      mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    },
    colors: ['#3498db']
  }
})

const newestDate = computed(() => {
  if (!pheDiary.value.length) return new Date()
  return pheDiary.value.reduce((newest, entry) => {
    const entryDate = parseISO(entry.date)
    return entryDate > newest ? entryDate : newest
  }, parseISO(pheDiary.value[0].date))
})

const oldestDate = computed(() => {
  if (!pheDiary.value.length) return new Date()
  return pheDiary.value.reduce((oldest, entry) => {
    const entryDate = parseISO(entry.date)
    return entryDate < oldest ? entryDate : oldest
  }, parseISO(pheDiary.value[0].date))
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

// Store original state for restoring on cancel
const originalEditedItem = ref(null)

const editItem = (item) => {
  editedIndex.value = pheDiary.value.indexOf(item)
  editedKey.value = item['.key']
  // Ensure log array exists (even if empty) for entries created via createDiaryDay
  const itemCopy = JSON.parse(JSON.stringify(item))
  if (!itemCopy.log) {
    itemCopy.log = []
  }
  editedItem.value = itemCopy
  originalEditedItem.value = JSON.parse(JSON.stringify(itemCopy)) // Store original state
  dialog.value.openDialog()
}

const deleteItem = async () => {
  // Capture values before closing (needed for API call and undo)
  const entryKey = editedKey.value
  const deletedItem = JSON.parse(
    JSON.stringify(pheDiary.value.find((item) => item['.key'] === entryKey))
  )

  // Close dialog immediately for instant feedback
  close()

  try {
    await deleteDiaryDay(entryKey)

    notifications.success(t('diary.entry-deleted'), {
      undoAction: async () => {
        try {
          // Restore the entry by recreating it
          // If it has log items, restore them one by one
          if (deletedItem.log && deletedItem.log.length > 0) {
            for (const logItem of deletedItem.log) {
              await addFoodItemToDiary({
                date: deletedItem.date,
                ...logItem
              })
            }
          } else {
            // Simple entry without log items - restore using createDiaryDay
            // This preserves the original structure without adding a "Manual Entry" log item
            await createDiaryDay({
              date: deletedItem.date,
              phe: deletedItem.phe || 0,
              kcal: deletedItem.kcal || 0
            })
          }
        } catch (error) {
          console.error('Undo error:', error)
          notifications.error('Failed to restore entry. Please add it manually.')
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
  // Restore original state if it exists (user cancelled)
  // This restores any local changes (like deleted log items) back to original
  if (originalEditedItem.value) {
    editedItem.value = JSON.parse(JSON.stringify(originalEditedItem.value))
    originalEditedItem.value = null
  }
  dialog.value.closeDialog()
  // Reset state after closing
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Convert phe and kcal to numbers, handling null/undefined/NaN/empty string
  // v-model.number can produce NaN for empty inputs, so we need to handle that
  const pheNum = Number(editedItem.value.phe)
  const kcalNum = Number(editedItem.value.kcal)

  const pheValue =
    editedItem.value.phe != null && editedItem.value.phe !== '' && !isNaN(pheNum) ? pheNum : 0
  const kcalValue =
    editedItem.value.kcal != null && editedItem.value.kcal !== '' && !isNaN(kcalNum) ? kcalNum : 0

  // Capture state before closing (needed to determine if editing or creating)
  const isEditing = editedIndex.value > -1
  const entryKey = editedKey.value
  const entryDate = editedItem.value.date
  const entryLog = editedItem.value.log || []

  // Clear original state and close dialog immediately for instant feedback
  originalEditedItem.value = null
  close()

  try {
    if (isEditing && entryKey) {
      // Update existing diary entry totals, date, and log items
      // This syncs any log item deletions and date changes that were made locally
      await updateDiaryDay({
        entryKey: entryKey,
        date: entryDate,
        phe: pheValue,
        kcal: kcalValue,
        log: entryLog
      })
      notifications.success(t('common.saved'))
    } else {
      // Create a new day entry (not a food item)
      // This always creates a new diary entry, even if a day with the same date already exists
      await createDiaryDay({
        date: entryDate,
        phe: pheValue,
        kcal: kcalValue
      })
      notifications.success(t('common.saved'))
    }
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save error:', error)
  }
}

// Start add/edit log

const editedLogIndex = ref(-1)

const defaultLogItem = {
  name: '',
  emoji: null,
  icon: null,
  pheReference: null,
  kcalReference: null,
  weight: null,
  phe: null,
  kcal: null
}

const editedLogItem = ref({ ...defaultLogItem })

const logFormTitle = computed(() => {
  return editedLogIndex.value === -1 ? t('common.add') : t('common.edit')
})

const calculatePhe = () => {
  return Math.round((editedLogItem.value.weight * editedLogItem.value.pheReference) / 100) || 0
}

const calculateKcal = () => {
  return Math.round((editedLogItem.value.weight * editedLogItem.value.kcalReference) / 100) || 0
}

const editLogItem = (item, index) => {
  editedLogIndex.value = index
  editedLogItem.value = { ...item }
  dialog2.value.openDialog()
}

const deleteLogItem = () => {
  if (!editedItem.value.log || editedLogIndex.value < 0) {
    return
  }

  // Update local state immediately so UI reflects the change
  // The deletion will be saved when the main dialog is saved
  editedItem.value.log.splice(editedLogIndex.value, 1)

  // Recalculate totals
  const totalPhe = editedItem.value.log.reduce((sum, item) => sum + (item.phe || 0), 0)
  const totalKcal = editedItem.value.log.reduce((sum, item) => sum + (item.kcal || 0), 0)
  editedItem.value.phe = totalPhe
  editedItem.value.kcal = totalKcal

  // Close the log edit dialog
  closeLogEdit()
}

const closeLogEdit = () => {
  dialog2.value.closeDialog()
  editedLogItem.value = { ...defaultLogItem }
  editedLogIndex.value = -1
}

const openAddLogItem = () => {
  // Reset log item state for adding new item
  editedLogIndex.value = -1
  editedLogItem.value = { ...defaultLogItem }
  dialog2.value.openDialog()
}

const saveLogEdit = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  const updatedItem = {
    name: editedLogItem.value.name,
    emoji: editedLogItem.value.emoji || null,
    icon: editedLogItem.value.icon || null,
    pheReference: editedLogItem.value.pheReference
      ? Number(editedLogItem.value.pheReference)
      : null,
    kcalReference: editedLogItem.value.kcalReference
      ? Number(editedLogItem.value.kcalReference)
      : null,
    weight: Number(editedLogItem.value.weight),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  try {
    if (editedLogIndex.value > -1) {
      // Update existing log item - only update local state
      // Changes will be saved when the main dialog is saved
      if (editedItem.value.log && editedItem.value.log[editedLogIndex.value]) {
        editedItem.value.log[editedLogIndex.value] = updatedItem

        // Recalculate totals
        const totalPhe = editedItem.value.log.reduce((sum, item) => sum + (item.phe || 0), 0)
        const totalKcal = editedItem.value.log.reduce((sum, item) => sum + (item.kcal || 0), 0)
        editedItem.value.phe = totalPhe
        editedItem.value.kcal = totalKcal
      }

      notifications.success(t('common.saved'))
    } else {
      // Add new log item - only update local state
      // Changes will be saved when the main dialog is saved
      if (!editedKey.value) {
        notifications.error('No entry selected. Please edit an entry first.')
        return
      }

      // Update local state immediately so UI reflects the change
      // Create a new array to ensure Vue reactivity works
      const currentLog = editedItem.value.log || []
      editedItem.value.log = [...currentLog, updatedItem]

      // Recalculate totals
      const totalPhe = editedItem.value.log.reduce((sum, item) => sum + (item.phe || 0), 0)
      const totalKcal = editedItem.value.log.reduce((sum, item) => sum + (item.kcal || 0), 0)
      editedItem.value.phe = totalPhe
      editedItem.value.kcal = totalKcal

      notifications.success(t('common.saved'))
    }
    closeLogEdit()
  } catch (error) {
    // Error handling
    console.error('Save log edit error:', error)
    notifications.error('Failed to save log item. Please try again.')
  }
}

// End add/edit log

const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  return `"${value.toString().replace(/"/g, '""')}"`
}

const exportAllFoodItems = async () => {
  const r = await confirm.confirm({
    title: t('diet-report.export-food'),
    message: t('diet-report.export-food-description'),
    confirmLabel: t('common.export'),
    cancelLabel: t('common.cancel'),
    variant: 'default'
  })
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Date,Name,Weight,Phe,Kcal\n'

    pheDiary.value.forEach((diaryEntry) => {
      const date = formatISO(parseISO(diaryEntry.date), { representation: 'date' })
      if (diaryEntry.log && diaryEntry.log.length > 0) {
        diaryEntry.log.forEach((logEntry) => {
          const row =
            [
              escapeCSV(date),
              escapeCSV(logEntry.name),
              escapeCSV(logEntry.weight),
              escapeCSV(logEntry.phe),
              escapeCSV(logEntry.kcal)
            ].join(',') + '\n'
          csvContent += row
        })
      }
    })
    triggerDownload(csvContent)
  }
}

const exportDailyPheTotals = async () => {
  const r = await confirm.confirm({
    title: t('diet-report.export-days'),
    message: t('diet-report.export-days-description'),
    confirmLabel: t('common.export'),
    cancelLabel: t('common.cancel'),
    variant: 'default'
  })
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Date,Total Phe,Total Kcal\n'

    pheDiary.value.forEach((diaryEntry) => {
      const date = formatISO(parseISO(diaryEntry.date), { representation: 'date' })
      const row =
        [escapeCSV(date), escapeCSV(diaryEntry.phe), escapeCSV(diaryEntry.kcal)].join(',') + '\n'
      csvContent += row
    })
    triggerDownload(csvContent)
  }
}

const triggerDownload = (csvContent) => {
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', t('diet-report.export-filename') + '.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const updateData = (timeline) => {
  selection.value = timeline

  switch (timeline) {
    case 'all':
      chartRef.value.chart.zoomX(oldestDate.value.getTime(), newestDate.value.getTime())
      break
    case 'one_week':
      chartRef.value.chart.zoomX(
        subWeeks(newestDate.value, 1).getTime(),
        newestDate.value.getTime()
      )
      break
    case 'two_weeks':
      chartRef.value.chart.zoomX(
        subWeeks(newestDate.value, 2).getTime(),
        newestDate.value.getTime()
      )
      break
    case 'one_month':
      chartRef.value.chart.zoomX(
        subMonths(newestDate.value, 1).getTime(),
        newestDate.value.getTime()
      )
      break
    case 'three_months':
      chartRef.value.chart.zoomX(
        subMonths(newestDate.value, 3).getTime(),
        newestDate.value.getTime()
      )
      break
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/diet-report',
      de: '/diaetbericht',
      es: '/informe-dieta',
      fr: '/rapport-regime'
    }
  }
})

useSeoMeta({
  title: () => t('diet-report.title'),
  description: () => t('diet-report.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('diet-report.title') + ' - PKU Tools',
  description: () => t('diet-report.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('diet-report.tab-title')" class="inline-block" />
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
      <p v-if="pheDiary.length < 2" class="mb-6">{{ $t('diet-report.chart-info') }}</p>

      <div v-if="pheDiary.length >= 2">
        <div class="flex gap-2 mb-4">
          <button
            v-for="(period, idx) in ['all', 'one_week', 'two_weeks', 'one_month', 'three_months']"
            :key="idx"
            :class="[
              'px-3 py-1 text-sm rounded-md',
              selection === period
                ? 'bg-black/5 dark:bg-white/15'
                : 'text-gray-700 dark:text-gray-300'
            ]"
            @click="updateData(period)"
          >
            {{
              period === 'one_week'
                ? '1W'
                : period === 'two_weeks'
                  ? '2W'
                  : period === 'one_month'
                    ? '1M'
                    : period === 'three_months'
                      ? '3M'
                      : 'ALL'
            }}
          </button>
        </div>

        <ClientOnly>
          <apexchart
            ref="chartRef"
            type="area"
            height="250"
            :options="chartOptions"
            :series="graph"
            class="-mb-2"
          />
        </ClientOnly>
      </div>

      <div class="mb-8">
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div
                class="overflow-hidden shadow-sm ring-1 ring-gray-300 dark:ring-gray-800 ring-opacity-5 sm:rounded-lg"
              >
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead class="bg-gray-50 dark:bg-gray-950">
                    <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                      <th
                        v-for="(header, index) in headerGroup.headers"
                        :key="header.id"
                        :class="[
                          'py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-300 whitespace-nowrap',
                          index === 0 ? 'pl-4 pr-3 sm:pl-6' : 'px-3'
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
                        @click="editItem(row.original)"
                      >
                        <td
                          v-for="cell in row.getVisibleCells()"
                          :key="cell.id"
                          :class="[
                            'py-4 text-sm whitespace-nowrap',
                            cell.column.id === 'date'
                              ? 'pl-4 pr-3 sm:pl-6 font-medium text-gray-900 dark:text-gray-300'
                              : 'px-3 font-normal text-gray-500 dark:text-gray-400'
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
        @close="close"
      >
        <DateInput v-model="editedItem.date" id-name="date" :label="$t('diet-report.date')" />

        <div class="flex gap-4">
          <NumberInput
            v-model.number="editedItem.phe"
            id-name="total-phe"
            :label="$t('diet-report.phe')"
            class="flex-1"
          />
          <NumberInput
            v-model.number="editedItem.kcal"
            id-name="kcal"
            :label="$t('common.total-kcal')"
            class="flex-1"
          />
        </div>

        <div v-if="editedItem.log" class="flex justify-between items-center -mb-3">
          <h4 class="text-sm font-medium">
            {{ $t('diary.title') }}
          </h4>
          <SecondaryButton :text="$t('common.add')" class="mr-0! mb-0!" @click="openAddLogItem" />
        </div>

        <DataTable v-if="editedItem.log" :headers="tableHeaders2" class="mb-3">
          <tr
            v-for="(item, index) in editedItem.log"
            :key="index"
            class="cursor-pointer"
            @click="editLogItem(item, index)"
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
              {{ item.phe }}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ item.kcal }}
            </td>
          </tr>
        </DataTable>
      </ModalDialog>

      <ModalDialog
        ref="dialog2"
        :title="logFormTitle"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedLogIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="saveLogEdit"
        @delete="deleteLogItem"
        @close="closeLogEdit"
      >
        <TextInput v-model="editedLogItem.name" id-name="food" :label="$t('common.food-name')" />
        <div class="flex gap-4">
          <NumberInput
            v-model.number="editedLogItem.pheReference"
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            class="flex-1"
          />
          <NumberInput
            v-model.number="editedLogItem.kcalReference"
            id-name="kcalRef"
            :label="$t('common.kcal-per-100g')"
            class="flex-1"
          />
        </div>
        <NumberInput
          v-model.number="editedLogItem.weight"
          id-name="weight"
          :label="$t('common.consumed-weight')"
        />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>
      </ModalDialog>

      <SecondaryButton
        v-if="license"
        :text="$t('diet-report.export-food')"
        @click="exportAllFoodItems"
      />
      <SecondaryButton
        v-if="license"
        :text="$t('diet-report.export-days')"
        @click="exportDailyPheTotals"
      />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.diary-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-3 text-sm">
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
