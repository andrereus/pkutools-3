<script setup>
const model = defineModel({ type: String, required: true })
const { t } = useI18n()
const options = computed(() => [
  { title: t('food-search.title'), value: 'food-search' },
  { title: t('barcode-scanner.title'), value: 'barcode-scanner' },
  { title: t('ai-calculator.title'), value: 'ai-calculator' },
  { title: t('phe-calculator.title'), value: 'phe-calculator' }
])
</script>

<template>
  <VisualChoicePicker
    v-model="model"
    :label="$t('settings.preferred-tool')"
    :options="options"
    stacked
  >
    <template #visual="{ option }">
      <LucideSearch v-if="option.value === 'food-search'" class="h-5 w-5" />
      <LucideScanBarcode v-else-if="option.value === 'barcode-scanner'" class="h-5 w-5" />
      <LucideSparkles v-else-if="option.value === 'ai-calculator'" class="h-5 w-5" />
      <LucideCalculator v-else class="h-5 w-5" />
    </template>
  </VisualChoicePicker>
</template>
