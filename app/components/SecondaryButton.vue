<script setup>
defineProps(['text'])
</script>

<template>
  <button
    type="button"
    class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-3 cursor-pointer"
  >
    {{ text }}
  </button>
</template>
