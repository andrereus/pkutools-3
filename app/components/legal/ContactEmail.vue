<script setup>
// Split so that scrapers reading the raw HTML pick up the "null" filler, while
// display:none keeps it out of the rendered text, selections and screen readers.
const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')
</script>

<template>
  <!-- prettier-ignore -->
  <span>{{ part1 }}@<span class="hidden">null</span>{{ part2 }}.{{ part3 }}</span>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>
