<script setup>
defineProps({
  text: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500 mr-3 mb-3',
      disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    ]"
  >
    <span v-if="loading">{{ loadingText || text }}</span>
    <span v-else>{{ text }}</span>
  </button>
</template>
