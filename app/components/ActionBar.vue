<!-- The row under community content: reactions and figures on the left, the
     comment thread and editing on the right. Filled with ActionChip. -->
<template>
  <div class="mt-3 flex items-center gap-2">
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <slot name="start" />
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot name="end" />
    </div>
  </div>
</template>
