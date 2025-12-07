<script setup>
import { useStore } from '../../stores/index'
import { format, subDays } from 'date-fns'

const store = useStore()

const settings = computed(() => store.settings)
const pheDiary = computed(() => store.pheDiary)

const yesterdayEntry = computed(() => {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  return pheDiary.value.find((entry) => entry.date === yesterday)
})
</script>

<template>
  <div
    v-if="yesterdayEntry && settings?.maxPhe"
    class="overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-sm"
  >
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center gap-3 font-medium mb-2">
        <LucideCalendar class="h-5 w-5" />
        {{ $t('assistant.previous-day') }}
      </div>
      <p>
        {{
          $t('assistant.previous-day-text', {
            phe: Math.round(yesterdayEntry.phe),
            percentage: Math.round((yesterdayEntry.phe / settings.maxPhe) * 100)
          })
        }}
      </p>
    </div>
  </div>
</template>
