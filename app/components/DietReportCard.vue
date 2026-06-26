<script setup>
import { useStore } from '../../stores/index'

const store = useStore()
const { t } = useI18n()

const settings = computed(() => store.settings)
const pheDiary = computed(() => store.pheDiary)

const PERIOD_DAYS = 14

// The most recent complete diary days (ignores days flagged incomplete). Driven
// by the data rather than a strict calendar window, so the card still summarizes
// the latest entries when logging has gaps.
const recentDays = computed(() =>
  [...pheDiary.value]
    .filter((entry) => !entry.incomplete)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, PERIOD_DAYS)
)

const dayValues = (key) => recentDays.value.filter((e) => e[key] != null).map((e) => e[key])
const average = (vals) => Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)

// Both nutrients use the same metric: the recent-days average as a share of the
// daily target (maxPhe / maxKcal). The bar scales to the larger of avg/target so
// any overflow stays visible — `fillPct` is the part up to the target, `overPct`
// the part beyond it (0 when not over). Without a target we just show the average.
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

const showCard = computed(() => blocks.value.length > 0)
</script>

<template>
  <div
    v-if="showCard"
    class="overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
  >
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        {{ $t('diet-report.averages') }}
      </h3>

      <div class="grid gap-6 sm:grid-cols-2">
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

            <div class="flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 my-2">
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
    </div>
  </div>
</template>
