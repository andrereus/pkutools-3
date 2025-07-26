<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import { format, subDays } from 'date-fns'
import { Book } from 'lucide-vue-next'

const store = useStore()
const { t } = useI18n()

const settings = computed(() => store.settings)
const pheDiary = computed(() => store.pheDiary)
const showCard = computed(() => pheDiary.value.length >= 2)

// Helper to get diary entries for date range
const getDiaryEntriesForDays = (days, includeToday = false) => {
  return [...Array(days)]
    .map((_, i) => {
      const date = format(subDays(new Date(), includeToday ? i : i + 1), 'yyyy-MM-dd')
      return pheDiary.value.find((entry) => entry.date === date)
    })
    .filter(Boolean)
}

// Calculate Phe statistics
const pheStats = computed(() => {
  if (!settings.value?.maxPhe || !pheDiary.value.length) {
    return { average: 0, deviation: 0 }
  }

  const last14Days = getDiaryEntriesForDays(14, false)
  if (!last14Days.length) return { average: 0, deviation: 0 }

  const average = Math.round(
    last14Days.reduce((sum, entry) => sum + entry.phe, 0) / last14Days.length
  )
  const deviations = last14Days.map((entry) => Math.abs(1 - entry.phe / settings.value.maxPhe))
  const averageDeviation = Math.round(
    (deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length) * 100
  )

  return { average, deviation: averageDeviation }
})
</script>

<template>
  <div v-if="showCard" class="overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-sm">
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center gap-3 font-medium mb-2">
        <Book class="h-5 w-5" />
        {{ $t('assistant.diary-report') }}
      </div>
      <div>
        <p>{{ $t('assistant.phe-stats-average', { average: pheStats.average }) }}</p>
        <p>{{ $t('assistant.phe-stats-deviation', { deviation: pheStats.deviation }) }}</p>
      </div>
    </div>
  </div>
</template>
