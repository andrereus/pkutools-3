<script setup>
import { useStore } from '../../stores/index'
import { format, parseISO, formatISO, subMonths } from 'date-fns'
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
const notifications = useNotifications()
const confirm = useConfirm()
const { isPremium, isPremiumAI } = useLicense()
const { saveLabValue, updateLabValue, deleteLabValue } = useApi()

// Reactive dark-mode flag so the charts (incl. the toolbar menu) re-theme when
// the theme is toggled, instead of only after a page refresh.
const isDark = ref(
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
)
let themeObserver = null
onMounted(() => {
  const root = document.documentElement
  themeObserver = new MutationObserver(() => {
    isDark.value = root.classList.contains('dark')
  })
  themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] })
})
onUnmounted(() => {
  themeObserver?.disconnect()
})

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)

const defaultItem = {
  date: format(new Date(), 'yyyy-MM-dd'),
  phe: null,
  tyrosine: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const labValues = computed(() => store.labValues)
const settings = computed(() => store.settings)

// Period picker for the summary card.
const summaryPeriod = ref('all')
const SUMMARY_PERIODS = ['1m', '3m', '6m', 'all']
const summaryLabValues = computed(() => {
  const months = { '1m': 1, '3m': 3, '6m': 6 }[summaryPeriod.value]
  if (!months) return labValues.value
  const cutoff = subMonths(new Date(), months)
  return labValues.value.filter((o) => parseISO(o.date) >= cutoff)
})

// Time-in-range stats for one analyte over the given readings. Returns null when
// there are no readings (e.g. none fall in the selected period).
// Partial ranges are supported (e.g. only a minimum, as is common for tyrosine).
const rangeStats = (list, key, min, max) => {
  const withVal = list.filter((o) => o[key] != null)
  const total = withVal.length
  if (total === 0) return null
  let inRange = 0
  let above = 0
  let below = 0
  let last = null
  let sum = 0
  for (const o of withVal) {
    const v = o[key]
    sum += v
    if (max != null && v > max) above++
    else if (min != null && v < min) below++
    else inRange++
    if (!last || parseISO(o.date) > parseISO(last.date)) last = o
  }
  const pct = (n) => Math.round((n / total) * 100)
  const lastVal = last[key]
  const lastStatus =
    max != null && lastVal > max ? 'above' : min != null && lastVal < min ? 'below' : 'in'
  return {
    total,
    inRangePct: pct(inRange),
    abovePct: pct(above),
    belowPct: pct(below),
    avg: Math.round((sum / total) * 10) / 10,
    lastVal,
    lastStatus
  }
}

// One block per analyte that has a target set and at least one reading ever, so
// the card (and its period picker) stay visible even when the chosen period has
// no readings. `stats` is then null and the block shows a "no readings" note.
const summaryBlocks = computed(() => {
  const unit = settings.value.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
  const make = (key, label, min, max) => {
    if (min == null && max == null) return null
    if (!labValues.value.some((o) => o[key] != null)) return null
    return { key, label, unit, stats: rangeStats(summaryLabValues.value, key, min, max) }
  }
  return [
    make(
      'phe',
      t('blood-values.phe-header'),
      settings.value.bloodPheMin,
      settings.value.bloodPheMax
    ),
    make(
      'tyrosine',
      t('blood-values.tyrosine-header'),
      settings.value.bloodTyrMin,
      settings.value.bloodTyrMax
    )
  ].filter(Boolean)
})

const statusArrow = (s) => (s === 'above' ? '▲' : s === 'below' ? '▼' : '✓')
const statusClass = (s) =>
  s === 'above'
    ? 'text-red-600 dark:text-red-400'
    : s === 'below'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-green-600 dark:text-green-400'

const license = computed(() => isPremium.value)

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const getlocalDate = (date) => {
  if (date) {
    const locales = { enUS, de, fr, es }
    return format(parseISO(date), 'eee P', { locale: locales[i18nLocale.value] })
  } else {
    return ''
  }
}

// Table state — newest readings first by default
const sorting = ref([{ id: 'date', desc: true }])
const columnFilters = ref([])
const columnVisibility = ref({})

// Column definitions
const columns = [
  {
    accessorKey: 'date',
    header: ({ column }) => {
      return h(DataTableColumnHeader, {
        column: column,
        title: t('blood-values.date')
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
        title: t('blood-values.phe-header')
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
    accessorKey: 'tyrosine',
    header: ({ column }) => {
      return h(DataTableColumnHeader, {
        column: column,
        title: t('blood-values.tyrosine-header')
      })
    },
    cell: ({ row }) => {
      return h('div', row.getValue('tyrosine'))
    },
    sortingFn: (rowA, rowB) => {
      const tyrA = rowA.original.tyrosine ?? 0
      const tyrB = rowB.original.tyrosine ?? 0
      return tyrA - tyrB
    }
  }
]

// Table instance
const table = useVueTable({
  data: labValues,
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

const graph = computed(() => {
  const newLabValues = labValues.value
  const chartLabValues = newLabValues
    .map((obj) => {
      return { x: obj.date, y: obj.phe }
    })
    .sort((a, b) => {
      return parseISO(a.x) - parseISO(b.x)
    })
  return [
    {
      name: t('blood-values.phe-header'),
      data: chartLabValues
    }
  ]
})

const graphTyrosine = computed(() => {
  const newLabValues = labValues.value
  const chartTyrosineValues = newLabValues
    .map((obj) => {
      return { x: obj.date, y: obj.tyrosine }
    })
    .sort((a, b) => {
      return parseISO(a.x) - parseISO(b.x)
    })
  return [
    {
      name: t('blood-values.tyrosine-header'),
      data: chartTyrosineValues
    }
  ]
})

// Therapeutic blood Phe target range (from settings): a shaded band between the
// two bounds with a dotted boundary line for each bound that is set (the dotted
// lines match the maxPhe line in the diet report).
const pheRangeAnnotations = computed(() => {
  const min = settings.value.bloodPheMin
  const max = settings.value.bloodPheMax
  const color = '#0ea5e9'
  const dottedLine = (y) => ({ y, borderWidth: 2, borderColor: color, strokeDashArray: 6 })
  const annotations = []
  if (min != null && max != null) {
    annotations.push({ y: min, y2: max, fillColor: color, opacity: 0.1, borderWidth: 0 })
  }
  if (min != null) annotations.push(dottedLine(min))
  if (max != null) annotations.push(dottedLine(max))
  return annotations
})

// Upper bound for the Phe chart's y-axis: large enough that the target lines are
// always visible, even when every reading sits below (or above) the range.
const pheYAxisMax = computed(() => {
  const phes = labValues.value.map((o) => o.phe).filter((v) => v != null)
  const dataMax = phes.length ? Math.max(...phes) : 0
  const targetTop = Math.max(settings.value.bloodPheMin ?? 0, settings.value.bloodPheMax ?? 0)
  const top = Math.max(dataMax, targetTop)
  return top > 0 ? Math.ceil(top * 1.1) : undefined
})

// Tyrosine target range — same treatment as Phe (shaded band + dotted boundary
// lines), in the tyrosine chart's amber color.
const tyrosineRangeAnnotations = computed(() => {
  const min = settings.value.bloodTyrMin
  const max = settings.value.bloodTyrMax
  const color = '#d97706'
  const dottedLine = (y) => ({ y, borderWidth: 2, borderColor: color, strokeDashArray: 6 })
  const annotations = []
  if (min != null && max != null) {
    annotations.push({ y: min, y2: max, fillColor: color, opacity: 0.1, borderWidth: 0 })
  }
  if (min != null) annotations.push(dottedLine(min))
  if (max != null) annotations.push(dottedLine(max))
  return annotations
})

const tyrosineYAxisMax = computed(() => {
  const tyrs = labValues.value.map((o) => o.tyrosine).filter((v) => v != null)
  const dataMax = tyrs.length ? Math.max(...tyrs) : 0
  const targetTop = Math.max(settings.value.bloodTyrMin ?? 0, settings.value.bloodTyrMax ?? 0)
  const top = Math.max(dataMax, targetTop)
  return top > 0 ? Math.ceil(top * 1.1) : undefined
})

// Period selector for both charts: narrows the visible x-axis window to the last
// N months (or all data), mirroring the diet report's range buttons. Blood tests
// are infrequent, so the steps are 1M/3M/6M/ALL (no weekly options).
const chartPeriod = ref('all')
const CHART_PERIODS = ['1m', '3m', '6m', 'all']
const pheChart = ref(null)
const tyrosineChart = ref(null)

const sortedLabDates = computed(() =>
  labValues.value.map((o) => parseISO(o.date)).sort((a, b) => a - b)
)
const oldestLabDate = computed(() => sortedLabDates.value[0] ?? new Date())
const newestLabDate = computed(
  () => sortedLabDates.value[sortedLabDates.value.length - 1] ?? new Date()
)

// X-axis window for the current period, applied in the chart options so a fresh
// render (mount, new reading, theme toggle) already starts at the right zoom.
// 'all' returns {} to keep ApexCharts' default padding.
const chartXAxisRange = computed(() => {
  const months = { '1m': 1, '3m': 3, '6m': 6 }[chartPeriod.value]
  if (!months) return {}
  return {
    min: subMonths(newestLabDate.value, months).getTime(),
    max: newestLabDate.value.getTime()
  }
})

// Switch period by panning the existing charts with zoomX (as the diet report
// does), so they aren't torn down and re-rendered. 'all' zooms to the full data
// extent so the reset actually applies — updateOptions merges, so an omitted
// min/max would leave the previous window stuck.
const setChartPeriod = (period) => {
  chartPeriod.value = period
  const months = { '1m': 1, '3m': 3, '6m': 6 }[period]
  const min = months
    ? subMonths(newestLabDate.value, months).getTime()
    : oldestLabDate.value.getTime()
  const max = newestLabDate.value.getTime()
  pheChart.value?.chart?.zoomX(min, max)
  tyrosineChart.value?.chart?.zoomX(min, max)
}

// Force a full chart re-render (instead of an in-place update) whenever the
// data, target range or theme changes. ApexCharts does not reliably recompute
// its yaxis scale or reposition yaxis annotations on a series/options update,
// so without this the chart keeps the old scale and target band until refresh.
const pheChartKey = computed(
  () =>
    `phe-${isDark.value}-${settings.value.bloodPheMin}-${settings.value.bloodPheMax}-` +
    labValues.value.map((o) => `${o.date}:${o.phe}`).join(',')
)

const tyrosineChartKey = computed(
  () =>
    `tyrosine-${isDark.value}-${settings.value.bloodTyrMin}-${settings.value.bloodTyrMax}-` +
    labValues.value.map((o) => `${o.date}:${o.tyrosine}`).join(',')
)

const chartOptions = computed(() => {
  const en = enChart
  const de = deChart
  const fr = frChart
  const es = esChart
  return {
    annotations: {
      yaxis: pheRangeAnnotations.value
    },
    chart: {
      locales: [en, de, fr, es],
      defaultLocale: i18nLocale.value,
      toolbar: {
        export: {
          csv: {
            filename: 'PKU Tools - Chart Data',
            headerCategory: 'Date',
            headerValue: 'Phe',
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
        }
      },
      zoom: {
        enabled: false
      },
      background: 'transparent'
    },
    stroke: {
      curve: 'smooth',
      width: 2
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
      type: 'datetime',
      ...(chartXAxisRange.value.min !== undefined && {
        min: chartXAxisRange.value.min,
        max: chartXAxisRange.value.max
      })
    },
    yaxis: {
      min: 0,
      max: pheYAxisMax.value
    },
    theme: {
      mode: isDark.value ? 'dark' : 'light'
    },
    colors: ['#0ea5e9']
  }
})

const chartOptionsTyrosine = computed(() => {
  const en = enChart
  const de = deChart
  const fr = frChart
  const es = esChart
  return {
    annotations: {
      yaxis: tyrosineRangeAnnotations.value
    },
    chart: {
      locales: [en, de, fr, es],
      defaultLocale: i18nLocale.value,
      toolbar: {
        export: {
          csv: {
            filename: 'PKU Tools - Chart Data (Tyrosine)',
            headerCategory: 'Date',
            headerValue: t('blood-values.tyrosine-header'),
            dateFormatter(timestamp) {
              return timestamp
            }
          },
          svg: {
            filename: 'PKU Tools - Chart (Tyrosine)'
          },
          png: {
            filename: 'PKU Tools - Chart (Tyrosine)'
          }
        }
      },
      zoom: {
        enabled: false
      },
      background: 'transparent'
    },
    stroke: {
      curve: 'smooth',
      width: 2
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
      type: 'datetime',
      ...(chartXAxisRange.value.min !== undefined && {
        min: chartXAxisRange.value.min,
        max: chartXAxisRange.value.max
      })
    },
    yaxis: {
      min: 0,
      max: tyrosineYAxisMax.value
    },
    theme: {
      mode: isDark.value ? 'dark' : 'light'
    },
    colors: ['#d97706']
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

const editItem = (item) => {
  editedIndex.value = labValues.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog.value.openDialog()
}

const deleteItem = async () => {
  // Capture values before closing (needed for API call and undo)
  const entryKey = editedKey.value
  const deletedItem = JSON.parse(
    JSON.stringify(labValues.value.find((item) => item['.key'] === entryKey))
  )

  // Close dialog immediately for instant feedback
  close()

  try {
    await deleteLabValue({
      entryKey: entryKey
    })

    notifications.success(t('blood-values.item-deleted'), {
      undoAction: async () => {
        try {
          // Restore the item by adding it back via save API
          await saveLabValue({
            date: deletedItem.date,
            phe: deletedItem.phe,
            tyrosine: deletedItem.tyrosine
          })
        } catch (error) {
          console.error('Undo error:', error)
          notifications.error(t('errors.restore-failed'))
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
  dialog.value.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const isSaving = ref(false)

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Check limit before saving (for better UX)
  if (editedIndex.value === -1 && labValues.value.length >= 30 && !isPremium.value) {
    notifications.error(t('app.limit'))
    return
  }

  // Capture state (needed to determine if editing or adding)
  const isEditing = editedIndex.value > -1
  const entryKey = editedKey.value
  const entryDate = editedItem.value.date
  const entryPhe = editedItem.value.phe ? Number(editedItem.value.phe) : null
  const entryTyrosine = editedItem.value.tyrosine ? Number(editedItem.value.tyrosine) : null

  isSaving.value = true
  try {
    if (isEditing && entryKey) {
      // Update existing entry - validates server-side with Zod
      await updateLabValue({
        entryKey: entryKey,
        date: entryDate,
        phe: entryPhe,
        tyrosine: entryTyrosine
      })
    } else {
      // Add new entry
      await saveLabValue({
        date: entryDate,
        phe: entryPhe,
        tyrosine: entryTyrosine
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

const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  return `"${value.toString().replace(/"/g, '""')}"`
}

const exportLabValues = async () => {
  const r = await confirm.confirm({
    title: t('blood-values.export'),
    message: t('common.export-description'),
    confirmLabel: t('common.export'),
    cancelLabel: t('common.cancel'),
    variant: 'default'
  })
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Date,Phe,Tyr\n'

    labValues.value.forEach((entry) => {
      const date = formatISO(parseISO(entry.date), { representation: 'date' })
      const row =
        [escapeCSV(date), escapeCSV(entry.phe), escapeCSV(entry.tyrosine)].join(',') + '\n'
      csvContent += row
    })
    triggerDownload(csvContent)
  }
}

const triggerDownload = (csvContent) => {
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', t('blood-values.export-filename') + '.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

definePageMeta({
  i18n: {
    paths: {
      en: '/blood-values',
      de: '/blutwerte',
      es: '/valores-sangre',
      fr: '/valeurs-sanguines'
    }
  }
})

useSeoMeta({
  title: () => t('blood-values.title'),
  description: () => t('blood-values.description')
})

defineOgImage('NuxtSeo', {
  title: () => t('blood-values.title') + ' - PKU Tools',
  description: () => t('blood-values.description'),
  theme: '#0ea5e9'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('blood-values.title')" />
    </header>

    <div v-if="!userIsAuthenticated">
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ $t('blood-values.description') }}</p>
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
      <div
        v-if="summaryBlocks.length"
        class="rounded-xl bg-white dark:bg-gray-900 px-4 py-5 sm:p-6 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 mb-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ $t('blood-values.summary') }}
          </h3>
          <div class="flex gap-1">
            <button
              v-for="p in SUMMARY_PERIODS"
              :key="p"
              type="button"
              :class="[
                'px-2 py-0.5 text-xs rounded-lg',
                summaryPeriod === p
                  ? 'bg-black/5 dark:bg-white/15 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              ]"
              @click="summaryPeriod = p"
            >
              {{ p === 'all' ? 'ALL' : p.toUpperCase() }}
            </button>
          </div>
        </div>
        <div class="grid gap-6 sm:grid-cols-2">
          <div v-for="block in summaryBlocks" :key="block.key">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{
                block.label
              }}</span>
              <span v-if="block.stats" class="text-xs text-gray-500 dark:text-gray-400">
                {{ block.stats.total }} {{ $t('blood-values.readings') }}
              </span>
            </div>
            <template v-if="block.stats">
              <div class="flex items-baseline gap-2">
                <span class="text-xl font-semibold text-gray-900 dark:text-white">
                  {{ block.stats.inRangePct }}%
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ $t('blood-values.in-range') }}
                </span>
              </div>
              <div class="flex h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 my-2">
                <div class="bg-amber-400" :style="{ width: block.stats.belowPct + '%' }"></div>
                <div class="bg-green-500" :style="{ width: block.stats.inRangePct + '%' }"></div>
                <div class="bg-red-500" :style="{ width: block.stats.abovePct + '%' }"></div>
              </div>
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span>∅ {{ block.stats.avg }} {{ block.unit }}</span>
                <span v-if="block.stats.belowPct">
                  ▼ {{ $t('blood-values.below-target') }} {{ block.stats.belowPct }}%
                </span>
                <span v-if="block.stats.abovePct">
                  ▲ {{ $t('blood-values.above-target') }} {{ block.stats.abovePct }}%
                </span>
                <span :class="statusClass(block.stats.lastStatus)">
                  {{ $t('blood-values.last-reading') }}: {{ block.stats.lastVal }} {{ block.unit }}
                  {{ statusArrow(block.stats.lastStatus) }}
                </span>
              </div>
            </template>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {{ $t('blood-values.no-readings-period') }}
            </p>
          </div>
        </div>
      </div>

      <p v-if="labValues.length < 2" class="mb-6">{{ $t('blood-values.chart-info') }}</p>

      <ClientOnly>
        <div v-if="labValues.length >= 2">
          <div class="flex gap-2 mb-4">
            <button
              v-for="p in CHART_PERIODS"
              :key="p"
              type="button"
              :class="[
                'px-3 py-1 text-sm rounded-lg',
                chartPeriod === p
                  ? 'bg-black/5 dark:bg-white/15'
                  : 'text-gray-700 dark:text-gray-300'
              ]"
              @click="setChartPeriod(p)"
            >
              {{ p === 'all' ? 'ALL' : p.toUpperCase() }}
            </button>
          </div>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('blood-values.phe-header') }}
          </p>
          <apexchart
            ref="pheChart"
            :key="pheChartKey"
            type="line"
            height="250"
            :options="chartOptions"
            :series="graph"
            class="mb-6"
          />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('blood-values.tyrosine-header') }}
          </p>
          <apexchart
            ref="tyrosineChart"
            :key="tyrosineChartKey"
            type="line"
            height="250"
            :options="chartOptionsTyrosine"
            :series="graphTyrosine"
            class="-mb-2"
          />
        </div>
      </ClientOnly>

      <div class="mb-8">
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div
                class="overflow-hidden shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 sm:rounded-xl"
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
                  <tbody
                    class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900"
                  >
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
        :loading="isSaving"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="save"
        @delete="deleteItem"
        @close="close"
      >
        <DateInput v-model="editedItem.date" id-name="date" :label="$t('blood-values.date')" />

        <NumberInput
          v-model.number="editedItem.phe"
          id-name="phe"
          :label="$t('blood-values.phe') + (settings.labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')"
        />

        <NumberInput
          v-model.number="editedItem.tyrosine"
          id-name="tyrosine"
          :label="
            $t('blood-values.tyrosine') + (settings.labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')
          "
        />

        <p class="text-sm mt-4">{{ $t('blood-values.unit-info') }}</p>
      </ModalDialog>

      <SecondaryButton v-if="license" :text="$t('blood-values.export')" @click="exportLabValues" />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.blood-values-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-3 text-sm">
        <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
        {{ isPremiumAI ? $t('app.unlimited-ai') : $t('app.unlimited') }}
      </p>
    </div>
  </div>
</template>
