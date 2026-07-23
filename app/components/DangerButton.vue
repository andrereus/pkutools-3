<script setup>
defineProps({
  text: {
    type: String,
    required: true
  },
  outline: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <button
    type="button"
    :class="[
      'rounded-full px-3 py-1.5 text-sm font-semibold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 mr-3 mb-3 cursor-pointer',
      outline
        ? 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 focus-visible:outline-red-500 dark:bg-transparent dark:text-red-400 dark:ring-red-800 dark:hover:bg-red-900/20'
        : 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 dark:bg-red-500 dark:hover:bg-red-400 dark:shadow-none'
    ]"
  >
    {{ text }}
  </button>
</template>
