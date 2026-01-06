<script setup>
import { useStore } from '../../stores/index'
import { format } from 'date-fns'

const store = useStore()

const settings = computed(() => store.settings)
const pheDiary = computed(() => store.pheDiary)

const todayEntry = computed(() => {
  const today = format(new Date(), 'yyyy-MM-dd')
  return pheDiary.value.find((entry) => entry.date === today)
})

const nutritionBalance = computed(() => {
  if (!todayEntry.value || !settings.value?.maxPhe || !settings.value?.maxKcal) return null

  const phePercentage = (todayEntry.value.phe / settings.value.maxPhe) * 100
  const kcalPercentage = (todayEntry.value.kcal / settings.value.maxKcal) * 100

  return {
    phePercentage,
    kcalPercentage,
    difference: phePercentage - kcalPercentage
  }
})
</script>

<template>
  <div
    v-if="nutritionBalance"
    class="overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-sm"
  >
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center gap-3 font-medium mb-2">
        <LucideClock class="h-5 w-5" />
        {{ $t('insights.satiety-tip') }}
      </div>
      <p>
        <template v-if="nutritionBalance.difference > 5">
          {{
            $t('insights.satiety-tip-high', {
              phePercentage: Math.round(nutritionBalance.phePercentage),
              kcalPercentage: Math.round(nutritionBalance.kcalPercentage)
            })
          }}
        </template>
        <template v-else-if="nutritionBalance.difference < -5">
          {{
            $t('insights.satiety-tip-low', {
              phePercentage: Math.round(nutritionBalance.phePercentage),
              kcalPercentage: Math.round(nutritionBalance.kcalPercentage)
            })
          }}
        </template>
        <template v-else>
          {{
            $t('insights.satiety-tip-text', {
              phePercentage: Math.round(nutritionBalance.phePercentage),
              kcalPercentage: Math.round(nutritionBalance.kcalPercentage)
            })
          }}
        </template>
      </p>
    </div>
  </div>
</template>
