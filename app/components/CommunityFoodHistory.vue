<script setup lang="ts">
import type { CommunityFoodContentUpdate } from '../composables/useApi'
import type { FoodContentField } from '#shared/utils/food-content'

const props = defineProps<{ entry: CommunityFoodContentUpdate }>()
const { t, locale } = useI18n()

const fieldLabel = (field: FoodContentField) => {
  if (field === 'name') return t('common.food-name')
  if (field === 'note') return t('news.food-history-note')
  if (field === 'factor') return t('news.food-history-factor')
  if (field === 'phe') return t('news.food-history-phe')
  return t(`common.${field}`)
}

const description = computed(() => {
  if (props.entry.changedFields.length === 0) return t('news.food-edited')
  const fields = new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
    props.entry.changedFields.map(fieldLabel)
  )
  return t('news.food-history-changed', { fields })
})

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'short' }).format(timestamp)
</script>

<template>
  <div
    class="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
  >
    <p class="font-medium">{{ description }}</p>
    <time class="shrink-0" :datetime="new Date(entry.createdAt).toISOString()">
      {{ formatDate(entry.createdAt) }}
    </time>
  </div>
</template>
