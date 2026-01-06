<script setup>
import { useStore } from '../../stores/index'
import { parseISO } from 'date-fns'

const store = useStore()

const settings = computed(() => store.settings)
const labValues = computed(() => store.labValues)

const recentLabValues = computed(() => {
  if (!labValues.value.length) return null
  return [...labValues.value].sort((a, b) => parseISO(b.date) - parseISO(a.date))[0]
})
</script>

<template>
  <div
    v-if="recentLabValues"
    class="overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-sm"
  >
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center gap-3 font-medium mb-2">
        <LucideChartLine class="h-5 w-5" />
        {{ $t('insights.blood-values') }}
      </div>
      <p>
        {{
          $t('insights.blood-values-phe', {
            phe: recentLabValues.phe,
            unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
          })
        }}
      </p>
      <p>
        {{
          $t('insights.blood-values-tyrosine', {
            tyrosine: recentLabValues.tyrosine,
            unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
          })
        }}
      </p>
    </div>
  </div>
</template>
