<script setup>
defineProps({
  label: {
    type: String,
    default: null
  },
  small: {
    type: Boolean,
    default: false
  },
  thin: {
    type: Boolean,
    default: false
  }
})
const model = defineModel()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="!!model"
    :class="[
      'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
      small ? 'h-5 w-9' : 'h-6 w-11',
      thin ? 'bg-transparent' : model ? 'bg-sky-600' : 'bg-gray-200 dark:bg-gray-700'
    ]"
    @click="model = !model"
  >
    <span v-if="label" class="sr-only">{{ label }}</span>
    <span
      v-if="thin"
      aria-hidden="true"
      :class="[
        'pointer-events-none absolute inset-x-0.5 top-1/2 h-2 -translate-y-1/2 rounded-full transition-colors duration-200',
        model ? 'bg-sky-600' : 'bg-gray-300 dark:bg-gray-600'
      ]"
    />
    <span
      aria-hidden="true"
      :class="[
        'pointer-events-none relative inline-block transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out',
        thin ? 'ring-1 ring-gray-300 dark:ring-gray-600' : '',
        small ? 'h-4 w-4' : 'h-5 w-5',
        thin
          ? model
            ? small
              ? 'translate-x-3.5'
              : 'translate-x-4.5'
            : 'translate-x-0.5'
          : model
            ? small
              ? 'translate-x-4'
              : 'translate-x-5'
            : 'translate-x-0'
      ]"
    />
  </button>
</template>
