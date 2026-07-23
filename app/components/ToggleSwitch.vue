<script setup>
defineProps({
  label: {
    type: String,
    default: null
  },
  small: {
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
      model ? 'bg-sky-600' : 'bg-gray-200 dark:bg-gray-700'
    ]"
    @click="model = !model"
  >
    <span v-if="label" class="sr-only">{{ label }}</span>
    <span
      aria-hidden="true"
      :class="[
        'pointer-events-none inline-block transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out',
        small ? 'h-4 w-4' : 'h-5 w-5',
        model ? (small ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0'
      ]"
    />
  </button>
</template>
