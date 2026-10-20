<script setup>
// The admin buttons of one card: a translation link, Hide or Show, and
// Delete. Icons only, since the page repeats them on every card.
defineProps({
  row: { type: Object, required: true },
  /** Opens the text in Google Translate; null when no translation is needed. */
  translateUrl: { type: String, default: null },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['hide', 'show', 'delete'])
</script>

<template>
  <div class="flex shrink-0 items-center gap-2">
    <ActionChip
      v-if="translateUrl"
      :to="translateUrl"
      target="_blank"
      square
      aria-label="Translate (opens Google Translate)"
      title="Translate (opens Google Translate)"
    >
      <LucideLanguages class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
    <ActionChip
      v-if="row.hidden"
      tone="sky"
      square
      :disabled="busy"
      aria-label="Show again"
      title="Show again"
      @click="emit('show')"
    >
      <LucideEye class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
    <ActionChip v-else square :disabled="busy" aria-label="Hide" title="Hide" @click="emit('hide')">
      <LucideEyeOff class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
    <ActionChip
      tone="red"
      accent
      square
      :disabled="busy"
      aria-label="Delete"
      title="Delete"
      @click="emit('delete')"
    >
      <LucideTrash2 class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
  </div>
</template>
