<script setup>
const model = defineModel({ type: String, required: true })
const { t } = useI18n()
const options = computed(() => [
  { title: t('settings.progress-style-circles'), value: 'circles' },
  { title: t('settings.progress-style-bars'), value: 'bars' }
])
</script>

<template>
  <VisualChoicePicker v-model="model" :label="$t('settings.progress-style')" :options="options">
    <template #visual="{ option }">
      <svg v-if="option.value === 'circles'" class="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke="currentColor"
          stroke-width="3"
          class="text-gray-300 dark:text-gray-600"
        />
        <circle
          cx="12"
          cy="12"
          r="8"
          pathLength="3"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="2 3"
          stroke-linecap="round"
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span v-else class="h-1.5 w-8 overflow-hidden rounded-full bg-gray-300 dark:bg-gray-600">
        <span class="block h-full w-2/3 rounded-full bg-current" />
      </span>
    </template>
  </VisualChoicePicker>
</template>
