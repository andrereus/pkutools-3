<script setup>
// Renders a list of collapsible questions. `items` is an array of
// { q, a } i18n keys, e.g. [{ q: 'help.faq.q1', a: 'help.faq.a1' }].
// Answers may contain line breaks (rendered via whitespace-pre-line).
// An item with an `id` is briefly highlighted when the page is opened with
// ?faq=<id>.
defineProps({
  items: {
    type: Array,
    required: true
  }
})

const route = useRoute()
const highlightId = computed(() => route.query.faq)
</script>

<template>
  <dl class="divide-y divide-gray-900/10 dark:divide-white/10">
    <HeadlessDisclosure
      v-for="(item, index) in items"
      :key="index"
      v-slot="{ open }"
      as="div"
      class="py-5 first:pt-0 last:pb-0"
    >
      <dt :class="{ 'faq-highlight': item.id && item.id === highlightId }">
        <HeadlessDisclosureButton
          class="flex w-full items-start justify-between gap-6 text-left text-gray-900 dark:text-white cursor-pointer"
        >
          <span class="text-base font-semibold leading-7">{{ $t(item.q) }}</span>
          <span class="flex h-7 items-center">
            <LucideMinus v-if="open" class="h-5 w-5 text-gray-400" aria-hidden="true" />
            <LucidePlus v-else class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </HeadlessDisclosureButton>
      </dt>
      <HeadlessDisclosurePanel as="dd" class="mt-3 pr-12">
        <!-- Items with a `slot` render custom content (e.g. images, links);
             the rest render their translated answer text. -->
        <slot v-if="item.slot" :name="item.slot" />
        <p v-else class="text-base leading-7 text-gray-600 dark:text-gray-400 whitespace-pre-line">
          {{ $t(item.a) }}
        </p>
      </HeadlessDisclosurePanel>
    </HeadlessDisclosure>
  </dl>
</template>

<style scoped>
/* The negative margin offsets the padding, so the tinted area grows around
   the question without shifting the layout. */
.faq-highlight {
  margin: -0.5rem -0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  animation: faq-highlight 3s ease-out;
}

@keyframes faq-highlight {
  0%,
  50% {
    background-color: rgb(14 165 233 / 0.15);
  }
  100% {
    background-color: transparent;
  }
}
</style>
