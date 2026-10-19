<script setup>
import { foodDetailRows } from '../utils/food-details'

// A food's details as label–value rows: the nutrients it has in a two-column
// grid, then source and Phe calculation. The same in News, admin,
// Food Search and Own Food.
const props = defineProps({
  /** Any record with nutrients and provenance: own, shared or reference food. */
  food: { type: Object, required: true },
  /** Grams the nutrient values are shown for. */
  weight: { type: Number, default: 100 }
})

const { t } = useI18n()
const rows = computed(() => foodDetailRows(props.food, props.weight, t))
</script>

<template>
  <div
    v-if="rows.nutrients.length > 0 || rows.details.length > 0"
    class="space-y-2 text-xs text-gray-500 sm:text-sm dark:text-gray-400"
  >
    <dl v-if="rows.nutrients.length > 0" class="grid grid-cols-2 gap-x-4 gap-y-1 sm:gap-x-6">
      <div v-for="row in rows.nutrients" :key="row.key" class="flex justify-between gap-2">
        <dt class="min-w-0">{{ row.label }}</dt>
        <dd class="shrink-0 whitespace-nowrap text-gray-900 dark:text-gray-200">
          {{ row.value }} g
        </dd>
      </div>
    </dl>
    <dl
      v-if="rows.details.length > 0"
      class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1"
    >
      <template v-for="row in rows.details" :key="row.key">
        <dt>{{ row.label }}</dt>
        <dd class="break-words text-gray-900 dark:text-gray-200">
          {{ row.value }}
          <span
            v-if="row.note"
            class="block text-gray-500 first-letter:uppercase dark:text-gray-400"
          >
            {{ row.note }}
          </span>
        </dd>
      </template>
    </dl>
  </div>
</template>
