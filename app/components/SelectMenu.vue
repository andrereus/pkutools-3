<script setup>
defineProps(['idName', 'label'])
const model = defineModel()
</script>

<template>
  <div>
    <label
      :for="idName"
      class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
      >{{ label }}</label
    >
    <select
      :id="idName"
      :name="idName"
      v-model="model"
      class="mt-1 mb-3 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-sky-500 sm:text-sm sm:leading-6 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500 bg-white dark:bg-gray-800"
    >
      <slot />
    </select>
  </div>
</template>
