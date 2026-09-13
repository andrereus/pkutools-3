<script setup>
defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true }
})
const model = defineModel({ type: String, required: true })
const name = useId()
</script>

<template>
  <fieldset>
    <legend class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-300">
      {{ label }}
    </legend>
    <div class="mt-2 flex flex-wrap gap-2">
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
          class="flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm leading-6 text-gray-900 ring-1 ring-inset ring-gray-300 peer-checked:ring-2 peer-checked:ring-sky-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-sky-500 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:peer-checked:ring-sky-500"
        >
          <span
            class="flex h-5 shrink-0 items-center justify-center text-theme-ink"
            aria-hidden="true"
          >
            <slot name="visual" :option="option" />
          </span>
          <span class="min-w-0 break-words">
            {{ option.shortTitle || option.title }}
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
