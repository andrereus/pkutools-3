<script setup>
import { ref, watch } from 'vue'
import { EyeOff, Eye } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps(['idName', 'label'])
const model = defineModel()
const showPassword = ref(false)
const errorMessage = ref('')
const { t } = useI18n()

const validatePassword = () => {
  if (model.value && model.value.length >= 8) {
    errorMessage.value = ''
  } else {
    errorMessage.value = t('email-auth.min-length')
  }
}

watch(model, () => {
  if (!model.value) {
    errorMessage.value = t('email-auth.required')
  } else {
    validatePassword()
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
      <div class="relative mt-1.5">
        <input
          :type="showPassword ? 'text' : 'password'"
          :name="idName"
          :id="idName"
          v-model="model"
          @blur="validatePassword"
          class="block w-full rounded-md border-0 bg-white py-1.5 pr-10 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
          spellcheck="false"
        />
        <div
          @click="showPassword = !showPassword"
          class="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
        >
          <Eye v-if="showPassword" class="h-5 w-5 text-gray-400" aria-hidden="true" />
          <EyeOff v-else class="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
      </div>
      <p v-if="errorMessage" class="text-red-600 text-sm mt-1.5">{{ errorMessage }}</p>
    </div>
  </div>
</template>
