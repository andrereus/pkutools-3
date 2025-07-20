<script setup>
defineProps(['text'])
</script>

<template>
  <button
    type="button"
    class="rounded-sm bg-sky-500 px-2 py-1 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 mr-3 mb-3 cursor-pointer"
  >
    {{ text }}
  </button>
</template>
