<script setup>
// A food's note, the same wherever the food is shown: on News and admin
// cards, and in the Food Search and Own Food dialogs.
defineProps({ note: { type: String, required: true } })
</script>

<template>
  <p
    class="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-gray-700 dark:bg-sky-900/20 dark:text-gray-300"
  >
    <LucideStickyNote
      class="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
      aria-hidden="true"
    />
    <span class="min-w-0 break-words whitespace-pre-wrap">{{ note }}</span>
  </p>
</template>
