<script setup>
import { useStore } from '../../stores/index'
import { subDays, subMonths, parseISO, format, differenceInDays } from 'date-fns'

const store = useStore()
const { t } = useI18n()

const settings = computed(() => store.settings)
const pheDiary = computed(() => store.pheDiary)

// Date-range picker.
const period = ref('all')
const PERIODS = ['1w', '2w', '1m', '3m', 'all']

// Complete diary days. Ignores days flagged incomplete and today, whose totals
// are still in progress (food tracking isn't finished yet) so they shouldn't
// skew the average.
const completeDays = computed(() => {
  const today = format(new Date(), 'yyyy-MM-dd')
  return pheDiary.value.filter(
    (entry) => !entry.incomplete && format(parseISO(entry.date), 'yyyy-MM-dd') !== today
  )
})

// Most recent complete day. The range counts back from here (not today) so the
// card's window matches the chart's for the same label, even when the latest
// entry isn't today.
const newestDate = computed(() => {
  if (!completeDays.value.length) return new Date()
  return completeDays.value.reduce((newest, entry) => {
    const entryDate = parseISO(entry.date)
    return entryDate > newest ? entryDate : newest
  }, parseISO(completeDays.value[0].date))
})

// Start date for the selected range ('all' → no cutoff).
const periodCutoff = (p) => {
  const anchor = newestDate.value
  if (p === '1w') return subDays(anchor, 7)
  if (p === '2w') return subDays(anchor, 14)
  if (p === '1m') return subMonths(anchor, 1)
  if (p === '3m') return subMonths(anchor, 3)
  return null
}

// Complete diary days within the selected range.
const periodDays = computed(() => {
  const cutoff = periodCutoff(period.value)
  if (!cutoff) return completeDays.value
  return completeDays.value.filter((entry) => parseISO(entry.date) >= cutoff)
})

// Smart default: start on the same range the chart picks (see diet-report.vue),
// so the averages line up with what's shown above. When the diary spans many
// days we default to a shorter range. Applied once — the user can still switch
// the picker freely afterward.
const DAYS_THRESHOLD_THREE_MONTHS = 90
const DAYS_THRESHOLD_ONE_MONTH = 30
const DAYS_THRESHOLD_TWO_WEEKS = 14

const dateRangeSpanInDays = computed(() => {
  if (completeDays.value.length < 2) return 0
  const oldest = completeDays.value.reduce((oldest, entry) => {
    const entryDate = parseISO(entry.date)
    return entryDate < oldest ? entryDate : oldest
  }, parseISO(completeDays.value[0].date))
  return differenceInDays(newestDate.value, oldest)
})

const defaultPeriodApplied = ref(false)
watch(
  () => dateRangeSpanInDays.value,
  (spanInDays) => {
    if (defaultPeriodApplied.value || spanInDays < 2) return
    defaultPeriodApplied.value = true
    if (spanInDays > DAYS_THRESHOLD_THREE_MONTHS) period.value = '3m'
    else if (spanInDays > DAYS_THRESHOLD_ONE_MONTH) period.value = '1m'
    else if (spanInDays > DAYS_THRESHOLD_TWO_WEEKS) period.value = '2w'
  },
  { immediate: true }
)

const dayValues = (key) => periodDays.value.filter((e) => e[key] != null).map((e) => e[key])
const average = (vals) => Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)

// Both nutrients use the same metric: the average over the selected range as a
// share of the daily target (maxPhe / maxKcal). The bar scales to the larger of
// avg/target so any overflow stays visible — `fillPct` is the part up to the
// target, `overPct` the part beyond it (0 when not over). Without a target we
// just show the average.
const buildBlock = (key, label, unit, target) => {
  const vals = dayValues(key)
  if (!vals.length) return null
  const avg = average(vals)
  if (!target) return { key, label, unit, total: vals.length, avg, pct: null }
  const pct = Math.round((avg / target) * 100)
  const scale = Math.max(avg, target)
  const fillPct = Math.round((Math.min(avg, target) / scale) * 100)
  const overPct = Math.round((Math.max(avg - target, 0) / scale) * 100)
  return { key, label, unit, total: vals.length, avg, target, pct, fillPct, overPct }
}

const blocks = computed(() =>
  [
    buildBlock('phe', t('common.phe'), 'mg', settings.value?.maxPhe),
    buildBlock('kcal', t('common.kcal'), t('common.kcal'), settings.value?.maxKcal)
  ].filter(Boolean)
)

// Card (with its picker) stays visible whenever there is any logged day, even if
// the selected range is empty — it then shows a "no entries" note.
const showCard = computed(() => pheDiary.value.some((entry) => !entry.incomplete))
</script>

<template>
  <div
    v-if="showCard"
    class="overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
  >
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ $t('diet-report.averages') }}
        </h3>
        <div class="flex gap-1">
          <button
            v-for="p in PERIODS"
            :key="p"
            type="button"
            :class="[
              'px-2 py-0.5 text-xs rounded-lg',
              period === p
                ? 'bg-black/5 dark:bg-white/15 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            ]"
            @click="period = p"
          >
            {{ p === 'all' ? 'ALL' : p.toUpperCase() }}
          </button>
        </div>
      </div>

      <div v-if="blocks.length" class="grid gap-6 sm:grid-cols-2">
        <div v-for="block in blocks" :key="block.key">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ block.label }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ block.total }} {{ $t('diet-report.days') }}
            </span>
          </div>

          <template v-if="block.pct !== null">
            <div class="flex items-baseline gap-2">
              <span class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ block.pct }}%
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('diet-report.of-target') }}
              </span>
            </div>

            <div class="flex h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 my-2">
              <div class="bg-sky-500" :style="{ width: block.fillPct + '%' }"></div>
              <div class="bg-sky-700" :style="{ width: block.overPct + '%' }"></div>
            </div>

            <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>∅ {{ block.avg }} {{ block.unit }}</span>
              <span>{{ $t('diet-report.target') }} {{ block.target }} {{ block.unit }}</span>
            </div>
          </template>
          <div v-else class="flex items-baseline gap-2">
            <span class="text-xl font-semibold text-gray-900 dark:text-white"
              >∅ {{ block.avg }}</span
            >
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ block.unit }}</span>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-gray-400 dark:text-gray-500">
        {{ $t('diet-report.no-entries-period') }}
      </p>
    </div>
  </div>
</template>
