<script setup>
import { useStore } from '../../stores/index'
import { parseISO } from 'date-fns'
import { ChartLine } from 'lucide-vue-next'

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
        <ChartLine class="h-5 w-5" />
        {{ $t('assistant.blood-values') }}
      </div>
      <p>
        <!-- Phe Analysis -->
        <template v-if="recentLabValues.phe > 10">
          {{
            $t('assistant.blood-values-high', {
              phe: recentLabValues.phe,
              unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
            })
          }}
        </template>
        <template v-else-if="recentLabValues.phe < 2">
          {{
            $t('assistant.blood-values-low', {
              phe: recentLabValues.phe,
              unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
            })
          }}
        </template>
        <template v-else>
          {{
            $t('assistant.blood-values-good', {
              phe: recentLabValues.phe,
              unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
            })
          }}
        </template>
      </p>
      <p>
        <!-- Tyrosine Analysis -->
        <template v-if="recentLabValues.tyrosine < 0.41">
          {{
            $t('assistant.blood-values-tyrosine-low', {
              tyrosine: recentLabValues.tyrosine,
              unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
            })
          }}
        </template>
        <template v-else-if="recentLabValues.tyrosine > 3.73">
          {{
            $t('assistant.blood-values-tyrosine-high', {
              tyrosine: recentLabValues.tyrosine,
              unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
            })
          }}
        </template>
        <template v-else>
          {{
            $t('assistant.blood-values-tyrosine-good', {
              tyrosine: recentLabValues.tyrosine,
              unit: settings?.labUnit === 'mgdl' ? 'mg/dL' : 'µmol/L'
            })
          }}
        </template>
      </p>
    </div>
  </div>
</template>
