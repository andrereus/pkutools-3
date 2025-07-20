<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps(['idName', 'label'])
const model = defineModel()
const errorMessage = ref('')
const { t } = useI18n()

const validateEmail = () => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  errorMessage.value = pattern.test(model.value) ? '' : t('email-auth.invalid-email')
}

watch(model, () => {
  if (!model.value) {
    errorMessage.value = t('email-auth.required')
  } else {
    validateEmail()
  }
})
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
        type="email"
        :name="idName"
        :id="idName"
        v-model="model"
        @blur="validateEmail"
        class="block w-full rounded-md border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
      />
      <p v-if="errorMessage" class="text-red-600 text-sm mt-1.5">{{ errorMessage }}</p>
    </div>
  </div>
</template>
