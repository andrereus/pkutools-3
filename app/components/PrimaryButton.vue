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
  }
})
</script>

<template>
  <button
    type="button"
    :disabled="disabled || loading"
    :class="[
      'rounded-sm bg-sky-500 px-2 py-1 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 mr-3 mb-3',
      disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    ]"
  >
    <span v-if="loading">{{ loadingText || text }}</span>
    <span v-else>{{ text }}</span>
  </button>
</template>
