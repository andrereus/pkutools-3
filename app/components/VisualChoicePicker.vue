<script setup>
defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true },
  stacked: { type: Boolean, default: false },
  columns: { type: Number, default: 2 }
})
const model = defineModel({ type: String, required: true })
const name = useId()
</script>

<template>
  <fieldset>
    <legend class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-300">
      {{ label }}
    </legend>
    <div
      class="mt-2 grid gap-2 sm:flex sm:flex-wrap"
      :class="columns === 3 ? 'grid-cols-3' : 'grid-cols-2'"
    >
      <label v-for="option in options" :key="option.value" class="min-w-0 cursor-pointer">
        <input
          v-model="model"
          type="radio"
          :name="name"
          :value="option.value"
          :aria-label="option.title"
          class="peer sr-only"
        />
        <span
          class="relative flex h-full min-h-9 items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-sm text-gray-900 ring-1 ring-gray-300 peer-checked:ring-theme-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-theme-ink dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600 dark:peer-checked:ring-theme-ink sm:gap-2 sm:px-3"
          :class="stacked ? 'flex-col justify-center sm:flex-row' : ''"
        >
          <span
            class="flex h-5 shrink-0 items-center justify-center text-theme-ink"
            aria-hidden="true"
          >
            <slot name="visual" :option="option" />
          </span>
          <span class="min-w-0 break-words sm:hidden" :class="stacked ? 'text-center' : ''">
            {{ option.shortTitle || option.title }}
          </span>
          <span class="hidden sm:inline">{{ option.title }}</span>
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center"
            :class="stacked ? 'absolute right-1 top-1 sm:static' : 'ml-auto sm:ml-0'"
            aria-hidden="true"
          >
            <LucideCheck v-if="model === option.value" class="h-4 w-4 text-theme-ink" />
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
