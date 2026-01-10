<script setup>
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-vue-next'

defineProps({
  column: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  class: {
    type: String,
    default: ''
  }
})
</script>

<script>
export default {
  inheritAttrs: false
}
</script>

<template>
  <div v-if="column.getCanSort()" :class="['flex items-center space-x-2', $attrs.class || '']">
    <button
      type="button"
      class="flex items-center hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded transition-colors"
      @click="column.toggleSorting()"
    >
      <span>{{ title }}</span>
      <ArrowUp v-if="column.getIsSorted() === 'asc'" class="w-4 h-4 ml-1" />
      <ArrowDown v-else-if="column.getIsSorted() === 'desc'" class="w-4 h-4 ml-1" />
      <ArrowUpDown v-else class="w-4 h-4 ml-1 opacity-50" />
    </button>
  </div>
  <div v-else :class="$attrs.class">
    {{ title }}
  </div>
</template>
