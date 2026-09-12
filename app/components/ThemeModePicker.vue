<script setup>
const model = defineModel({ type: String, required: true })
const { t } = useI18n()
const options = computed(() => [
  {
    title: t('settings.theme-system'),
    shortTitle: t('settings.theme-system-short'),
    value: 'system'
  },
  { title: t('settings.theme-light'), shortTitle: t('settings.theme-light-short'), value: 'light' },
  { title: t('settings.theme-dark'), shortTitle: t('settings.theme-dark-short'), value: 'dark' }
])
</script>

<template>
  <VisualChoicePicker
    v-model="model"
    :label="$t('settings.theme')"
    :options="options"
    stacked
    :columns="3"
  >
    <template #visual="{ option }">
      <LucideMonitor v-if="option.value === 'system'" class="h-5 w-5" />
      <LucideSun v-else-if="option.value === 'light'" class="h-5 w-5" />
      <LucideMoon v-else class="h-5 w-5" />
    </template>
  </VisualChoicePicker>
</template>
