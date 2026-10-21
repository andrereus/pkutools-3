<script setup>
// The admin buttons of one card: Remove or Restore, and Delete. Icons only,
// since the page repeats them on every card.
defineProps({
  row: { type: Object, required: true },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['hide', 'show', 'delete'])
</script>

<template>
  <div class="flex shrink-0 items-center gap-2">
    <ActionChip
      v-if="row.hidden"
      tone="sky"
      square
      :disabled="busy"
      :aria-label="$t('admin.restore')"
      :title="$t('admin.restore')"
      @click="emit('show')"
    >
      <LucideEye class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
    <ActionChip
      v-else
      square
      :disabled="busy"
      :aria-label="$t('admin.remove')"
      :title="$t('admin.remove')"
      @click="emit('hide')"
    >
      <LucideEyeOff class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
    <ActionChip
      tone="red"
      accent
      square
      :disabled="busy"
      :aria-label="$t('common.delete')"
      :title="$t('common.delete')"
      @click="emit('delete')"
    >
      <LucideTrash2 class="h-4 w-4" aria-hidden="true" />
    </ActionChip>
  </div>
</template>
