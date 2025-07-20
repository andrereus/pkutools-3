<script setup>
defineProps(['idName', 'label', 'placeholder'])
const model = defineModel()
</script>

<template>
  <div>
    <label
      :for="idName"
      class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
      >{{ label }}</label
    >
    <div class="mt-1 mb-3">
      <input
        type="number"
        :name="idName"
        :id="idName"
        v-model.number="model"
        class="block w-full rounded-md border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        :placeholder="placeholder"
      />
    </div>
  </div>
</template>
