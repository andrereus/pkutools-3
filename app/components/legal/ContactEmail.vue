<script setup>
// Split so that scrapers reading the raw HTML pick up the "not_" filler, while
// display:none keeps it out of the rendered text, selections and screen readers.
// The underscore makes the scraped domain invalid, so nobody can register it.
// A custom class, because HTML-to-Markdown converters drop Tailwind's `hidden`.
const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')
</script>

<template>
  <!-- prettier-ignore -->
  <span>{{ part1 }}@<span class="email-hidden">not_</span>{{ part2 }}.{{ part3 }}</span>
</template>

<style scoped>
.email-hidden {
  display: none;
}
</style>
