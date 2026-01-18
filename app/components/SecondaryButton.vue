<script setup>
defineProps({
  text: {
    type: String,
    required: true
  }
})
</script>

<template>
  <button
    type="button"
    class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 mr-3 mb-3 cursor-pointer"
  >
    {{ text }}
  </button>
</template>
