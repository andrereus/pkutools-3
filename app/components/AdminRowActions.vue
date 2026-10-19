<script setup>
// The buttons of one admin card: the thread and Remove for live content,
// Restore and Delete permanently for removed content, and a translation link
// for both. Icons only, since the page repeats them on every card.
defineProps({
  row: { type: Object, required: true },
  /** Opens the text in Google Translate; null when no translation is needed. */
  translateUrl: { type: String, default: null },
  busy: { type: Boolean, default: false },
  /** Whether this card's thread is the one being shown. */
  threadShown: { type: Boolean, default: false },
  retentionDays: { type: Number, required: true }
})

const emit = defineEmits(['thread', 'remove', 'restore', 'delete'])
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
    <template v-if="row.removedId">
      <ActionChip
        tone="sky"
        square
        :disabled="busy"
        aria-label="Restore"
        title="Restore"
        @click="emit('restore')"
      >
        <LucideArchiveRestore class="h-4 w-4" aria-hidden="true" />
      </ActionChip>
      <ActionChip
        tone="red"
        accent
        square
        :disabled="busy"
        aria-label="Delete permanently"
        title="Delete permanently"
        @click="emit('delete')"
      >
        <LucideTrash2 class="h-4 w-4" aria-hidden="true" />
      </ActionChip>
    </template>
    <template v-else>
      <ActionChip
        v-if="row.type !== 'comment'"
        tone="sky"
        :active="threadShown"
        :accent="row.commentCount > 0"
        :aria-label="`${row.commentCount} comments`"
        title="Show this thread"
        @click="emit('thread')"
      >
        <LucideMessageCircle class="h-4 w-4" aria-hidden="true" />
        <span v-if="row.commentCount > 0">{{ row.commentCount }}</span>
      </ActionChip>
      <ActionChip
        tone="red"
        accent
        square
        :disabled="busy"
        :aria-label="`Remove (restorable for ${retentionDays} days)`"
        :title="`Remove (restorable for ${retentionDays} days)`"
        @click="emit('remove')"
      >
        <LucideArchive class="h-4 w-4" aria-hidden="true" />
      </ActionChip>
    </template>
  </div>
</template>
