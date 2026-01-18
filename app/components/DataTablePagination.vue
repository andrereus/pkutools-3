<script setup>
import { computed } from 'vue'

const props = defineProps({
  table: {
    type: Object,
    required: true
  }
})

const { t } = useI18n()

const currentPage = computed(() => props.table.getState().pagination.pageIndex + 1)
const totalPages = computed(() => props.table.getPageCount())
</script>

<template>
  <div class="mt-6 flex justify-start items-center gap-4 mb-6">
    <button
      type="button"
      :disabled="!table.getCanPreviousPage()"
      @click="table.previousPage()"
      class="p-1 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400"
    >
      <LucideChevronLeft class="h-6 w-6" aria-hidden="true" />
    </button>
    <span class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('common.page') }} {{ currentPage }} {{ t('common.of') }} {{ totalPages }}
    </span>
    <button
      type="button"
      :disabled="!table.getCanNextPage()"
      @click="table.nextPage()"
      class="p-1 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400"
    >
      <LucideChevronRight class="h-6 w-6" aria-hidden="true" />
    </button>
  </div>
</template>
