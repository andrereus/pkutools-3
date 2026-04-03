<script setup>
import { useStore } from '../../stores/index'
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { format } from 'date-fns'

const store = useStore()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const notifications = useNotifications()
const { isPremium, isPremiumAI } = useLicense()
const { addFoodItemToDiary } = useApi()
const { ensureEmojiForLogEntry } = useFoodEmoji()
const { confirm } = useConfirm()

// Reactive state
const description = ref('')
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isEstimating = ref(false)
const isSaving = ref(false)
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)

// Result state
const result = ref(null) // { name, emoji, phePer100g, proteinPer100g, kcalPer100g, servingSizeGrams, explanation }
const weight = ref(null)

// Constants
const BASE_DAILY_ESTIMATE_LIMIT = 20
const PREMIUM_AI_DAILY_ESTIMATE_LIMIT = 100
const FREE_USER_DAILY_ESTIMATE_LIMIT = 2
const MAX_IMAGE_DIMENSION = 1024
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024 // 15MB

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const settings = computed(() => store.settings)

const estimateConfig = computed(() => {
  if (!isPremium.value) {
    return {
      model: 'gemini-2.5-flash',
      dailyLimitCredits: FREE_USER_DAILY_ESTIMATE_LIMIT,
      costPerEstimate: 1
    }
  }
  if (isPremiumAI.value) {
    return {
      model: 'gemini-2.5-flash',
      dailyLimitCredits: PREMIUM_AI_DAILY_ESTIMATE_LIMIT,
      costPerEstimate: 1
    }
  }
  return {
    model: 'gemini-2.5-flash',
    dailyLimitCredits: BASE_DAILY_ESTIMATE_LIMIT,
    costPerEstimate: 1
  }
})

const remainingEstimates = computed(() => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.value.estimationDate
  const currentCount = estimateDate === today ? settings.value.estimationCount || 0 : 0
  const { dailyLimitCredits, costPerEstimate } = estimateConfig.value
  const remainingCredits = Math.max(0, dailyLimitCredits - currentCount)
  return Math.floor(remainingCredits / costPerEstimate)
})

// Computed Phe: use phePer100g directly, or fall back to protein × 50
const pheReference = computed(() => {
  if (!result.value) return 0
  if (result.value.phePer100g !== null && !isNaN(result.value.phePer100g)) {
    return Math.round(result.value.phePer100g)
  }
  if (result.value.proteinPer100g !== null && !isNaN(result.value.proteinPer100g)) {
    return Math.round(result.value.proteinPer100g * 50)
  }
  return 0
})

const kcalReference = computed(() => {
  if (!result.value) return 0
  if (result.value.kcalPer100g !== null && !isNaN(result.value.kcalPer100g)) {
    return Math.round(result.value.kcalPer100g)
  }
  return 0
})

const isProteinFallback = computed(() => {
  if (!result.value) return false
  return (
    (result.value.phePer100g === null || isNaN(result.value.phePer100g)) &&
    result.value.proteinPer100g !== null &&
    !isNaN(result.value.proteinPer100g)
  )
})

const totalPhe = computed(() => {
  return Math.round((weight.value * pheReference.value) / 100) || 0
})

const totalKcal = computed(() => {
  return Math.round((weight.value * kcalReference.value) / 100) || 0
})

// Methods
const resizeAndConvertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      resolve(dataUrl.split(',')[1])
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

const onImageSelected = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (!isPremium.value) {
    notifications.error(t('phe-calculator.image-premium-only'))
    if (fileInputRef.value) fileInputRef.value.value = ''
    return
  }
  if (!file.type.startsWith('image/')) {
    notifications.error(t('phe-calculator.estimate-error-invalid-image'))
    if (fileInputRef.value) fileInputRef.value.value = ''
    return
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    notifications.error(t('phe-calculator.estimate-error-image-too-large'))
    if (fileInputRef.value) fileInputRef.value.value = ''
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

const removeImage = () => {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imageFile.value = null
  imagePreview.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const estimateFoodValues = async () => {
  if (isEstimating.value) return

  isEstimating.value = true
  result.value = null

  try {
    const hasText = description.value && description.value.trim() !== ''
    const hasImage = !!imageFile.value

    if (!hasText && !hasImage) {
      notifications.error(t('phe-calculator.estimate-error-no-input'))
      return
    }

    // If an image is attached, ask user to confirm sending it to Google Gemini
    if (hasImage) {
      isEstimating.value = false
      const confirmed = await confirm({
        title: t('phe-calculator.image-confirm-title'),
        message: t('phe-calculator.image-confirm-message'),
        confirmLabel: t('phe-calculator.image-confirm-proceed'),
        cancelLabel: t('common.cancel'),
        variant: 'default'
      })
      if (!confirmed) return
      isEstimating.value = true
    }

    // Sanitize text input
    const sanitizedText = description.value
      .trim()
      .slice(0, 500)
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .trim()

    // Check permission via server API
    const auth = getAuth()
    const currentUser = auth.currentUser
    if (!currentUser) {
      notifications.error(t('phe-calculator.estimate-error-firebase'))
      return
    }

    const token = await currentUser.getIdToken()
    const { model: modelName } = estimateConfig.value

    const checkResponse = await $fetch('/api/gemini/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { model: modelName }
    })

    if (!checkResponse.allowed) {
      notifications.error(
        t('phe-calculator.estimate-error-daily-limit', { limit: checkResponse.remaining })
      )
      return
    }

    // Initialize Firebase AI
    let firebaseApp
    try {
      firebaseApp = getApp()
    } catch {
      notifications.error(t('phe-calculator.estimate-error-firebase'))
      return
    }

    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })
    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    })

    const languageMap = { en: 'English', de: 'German', es: 'Spanish', fr: 'French' }
    const appLanguage = languageMap[locale.value] || 'English'

    let prompt
    if (hasImage && hasText) {
      // Image + text description
      prompt = `Identify the food in the image and estimate its nutritional values. Use the following description for additional context: "${sanitizedText}". If there are multiple foods, treat them as one combined meal.

Return JSON with these fields:
{
  "name": string (short descriptive name in ${appLanguage}) or null,
  "phePer100g": number (phenylalanine in mg per 100g) or null,
  "kcalPer100g": number (calories in kcal per 100g) or null,
  "proteinPer100g": number (protein in g per 100g) or null,
  "servingSizeGrams": number (estimated total weight in grams) or null,
  "emoji": string (exactly one emoji character) or null,
  "explanation": string (explanation in ${appLanguage}, maximum 140 characters) or null
}

Base estimates on typical nutritional databases. Use null for unknown values. For processed foods, use prepared/cooked state values unless specified otherwise.`
    } else if (hasImage) {
      // Image only
      prompt = `Identify the food in the image and estimate its nutritional values. If there are multiple foods, treat them as one combined meal.

Return JSON with these fields:
{
  "name": string (short descriptive name in ${appLanguage}) or null,
  "phePer100g": number (phenylalanine in mg per 100g) or null,
  "kcalPer100g": number (calories in kcal per 100g) or null,
  "proteinPer100g": number (protein in g per 100g) or null,
  "servingSizeGrams": number (estimated total weight based on visual size, in grams) or null,
  "emoji": string (exactly one emoji character) or null,
  "explanation": string (explanation in ${appLanguage}, maximum 140 characters) or null
}

Base estimates on typical nutritional databases. Use null for unknown values. For processed foods, use prepared/cooked state values unless specified otherwise.`
    } else {
      // Text description only
      prompt = `Estimate nutritional values for: "${sanitizedText}". If multiple foods are listed, treat them as one combined meal.

Return JSON with these fields:
{
  "name": string (short descriptive name in ${appLanguage}) or null,
  "phePer100g": number (phenylalanine in mg per 100g) or null,
  "kcalPer100g": number (calories in kcal per 100g) or null,
  "proteinPer100g": number (protein in g per 100g) or null,
  "servingSizeGrams": number (if a quantity or weight is mentioned, convert it to grams; otherwise use a typical serving size in g) or null,
  "emoji": string (exactly one emoji character) or null,
  "explanation": string (explanation in ${appLanguage}, maximum 140 characters) or null
}

Base estimates on typical nutritional databases. Use null for unknown values. For processed foods, use prepared/cooked state values unless specified otherwise.`
    }

    // Build content parts
    const contentParts = [prompt]
    if (hasImage) {
      const base64Data = await resizeAndConvertToBase64(imageFile.value)
      contentParts.push({
        inlineData: { mimeType: 'image/jpeg', data: base64Data }
      })
    }

    const aiResult = await model.generateContent(contentParts)
    const text = aiResult.response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const foodData = JSON.parse(jsonMatch[0])

    // Build result object
    result.value = {
      name: foodData.name || null,
      emoji:
        foodData.emoji && typeof foodData.emoji === 'string' && foodData.emoji.trim() !== ''
          ? foodData.emoji.trim()
          : null,
      phePer100g:
        foodData.phePer100g !== null &&
        foodData.phePer100g !== undefined &&
        !isNaN(Number(foodData.phePer100g))
          ? Math.round(Number(foodData.phePer100g))
          : null,
      proteinPer100g:
        foodData.proteinPer100g !== null &&
        foodData.proteinPer100g !== undefined &&
        !isNaN(Number(foodData.proteinPer100g))
          ? Math.round(Number(foodData.proteinPer100g) * 10) / 10
          : null,
      kcalPer100g:
        foodData.kcalPer100g !== null &&
        foodData.kcalPer100g !== undefined &&
        !isNaN(Number(foodData.kcalPer100g))
          ? Math.round(Number(foodData.kcalPer100g))
          : null,
      servingSizeGrams:
        foodData.servingSizeGrams !== null &&
        foodData.servingSizeGrams !== undefined &&
        !isNaN(Number(foodData.servingSizeGrams)) &&
        Number(foodData.servingSizeGrams) > 0
          ? Math.round(Number(foodData.servingSizeGrams))
          : null,
      explanation:
        foodData.explanation &&
        typeof foodData.explanation === 'string' &&
        foodData.explanation.trim() !== ''
          ? foodData.explanation.trim()
          : null
    }

    // Set editable weight from serving size
    weight.value = result.value.servingSizeGrams || 100

    notifications.success(t('phe-calculator.estimate-success'))
  } catch (error) {
    console.error('Error estimating food values:', error)

    const errorMessage = error?.message || error?.error?.message || ''
    const errorType = error?.type || error?.error?.type || ''

    if (
      errorType === 'RESOURCE_EXHAUSTED' ||
      errorMessage.includes('quota') ||
      errorMessage.includes('Quota exceeded') ||
      errorMessage.includes('rate limit')
    ) {
      notifications.error(t('phe-calculator.estimate-error-quota'))
    } else {
      notifications.error(t('phe-calculator.estimate-error'))
    }
  } finally {
    isEstimating.value = false
  }
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  if (!result.value) return

  let logEntry = {
    name: result.value.name || t('ai-calculator.title'),
    emoji: result.value.emoji || null,
    icon: null,
    pheReference: pheReference.value,
    kcalReference: kcalReference.value,
    weight: Number(weight.value),
    phe: totalPhe.value,
    kcal: totalKcal.value,
    note: result.value.explanation || null
  }

  isSaving.value = true

  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

    await addFoodItemToDiary({
      date: selectedDate.value,
      ...logEntry
    })
    notifications.success(t('common.saved'))
    navigateTo(localePath('diary'))
  } catch (error) {
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/ai-calculator',
      de: '/ki-rechner',
      es: '/calculadora-ia',
      fr: '/calculateur-ia'
    }
  }
})

useSeoMeta({
  title: () => t('ai-calculator.title'),
  description: () => t('ai-calculator.description')
})

defineOgImage('NuxtSeo', {
  title: () => t('ai-calculator.title') + ' - PKU Tools',
  description: () => t('ai-calculator.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <div v-if="userIsAuthenticated" class="block mb-6">
      <nav class="flex flex-wrap gap-1 justify-center" aria-label="Tabs">
        <NuxtLink
          :to="$localePath('food-search')"
          class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
        >
          <LucideSearch class="h-5 w-5" /> {{ $t('app.search') }}
        </NuxtLink>
        <NuxtLink
          :to="$localePath('barcode-scanner')"
          class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
        >
          <LucideScanBarcode class="h-5 w-5" /> {{ $t('app.scanner') }}
        </NuxtLink>
        <NuxtLink
          :to="$localePath('phe-calculator')"
          class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
        >
          <LucideCalculator class="h-5 w-5" /> {{ $t('app.calculator') }}
        </NuxtLink>
        <NuxtLink
          :to="$localePath('ai-calculator')"
          class="inline-flex items-center gap-2 bg-black/5 dark:bg-white/15 text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
          aria-current="page"
        >
          <LucideSparkles class="h-5 w-5" /> {{ $t('app.ai-calculator') }}
        </NuxtLink>
      </nav>
    </div>

    <header>
      <h2 class="text-2xl text-gray-900 dark:text-gray-300 mb-6">
        {{ $t('ai-calculator.title') }}
        <span class="ml-2 align-middle inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-500/30">Beta</span>
      </h2>
    </header>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="onImageSelected"
    />

    <div v-if="userIsAuthenticated" class="mt-2">
      <label for="description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300">
        {{ $t('ai-calculator.input-label') }}
      </label>
      <div class="mt-1">
        <textarea
          id="description"
          v-model="description"
          rows="4"
          :placeholder="$t('ai-calculator.input-placeholder')"
          :disabled="isEstimating"
          class="block w-full rounded-md border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        />
      </div>

      <div v-if="imageFile" class="flex items-center gap-4 mt-3">
        <div class="relative">
          <img
            :src="imagePreview"
            :alt="$t('phe-calculator.image-preview')"
            class="h-24 w-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            class="absolute -top-2 -right-2 rounded-full bg-red-500 p-0.5 text-white shadow-xs hover:bg-red-600 cursor-pointer"
            :title="$t('phe-calculator.remove-photo')"
            @click="removeImage"
          >
            <LucideX class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 mt-3">
        <button
          type="button"
          class="rounded-full bg-gray-200 p-1.5 text-gray-600 shadow-xs hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-9 flex items-center"
          :disabled="isEstimating"
          :title="$t('phe-calculator.add-photo')"
          @click="
            isPremium
              ? fileInputRef?.click()
              : notifications.error(t('phe-calculator.image-premium-only'))
          "
        >
          <LucideCamera class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-9 flex items-center"
          :disabled="isEstimating || ((!description || description.trim() === '') && !imageFile) || remainingEstimates === 0"
          @click="estimateFoodValues"
        >
          <span v-if="isEstimating">{{ $t('phe-calculator.estimating') }}</span>
          <span v-else>{{ $t('phe-calculator.estimate') }}</span>
        </button>
      </div>

    </div>

    <div v-if="result" class="mt-6 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
      <h2 class="text-xl font-semibold mb-4">
        <span v-if="result.emoji">{{ result.emoji }}&nbsp;</span>{{ result.name }}
      </h2>

      <div
        v-if="result.explanation"
        class="text-sm text-gray-600 dark:text-gray-400 italic break-words mb-4"
      >
        {{ result.explanation }}
      </div>

      <div class="flex gap-4 text-gray-600 dark:text-gray-400 mb-4">
        <span class="flex-1">{{ pheReference }} {{ $t('common.mg-phe-per-100g') }}</span>
        <span v-if="kcalReference" class="flex-1">{{ kcalReference }} {{ $t('common.kcal-per-100g') }}</span>
      </div>

      <div
        v-if="isProteinFallback"
        class="text-xs text-amber-600 dark:text-amber-400 mb-3"
      >
        {{ $t('ai-calculator.protein-fallback-note') }}
      </div>

      <DateInput v-model="selectedDate" id-name="date" :label="$t('common.date')" />

      <NumberInput
        v-model.number="weight"
        id-name="weight"
        :label="$t('ai-calculator.serving-size')"
      />

      <div class="flex gap-4 my-4">
        <span class="flex-1 text-lg">
          <template v-if="isProteinFallback">≈</template>
          <template v-else>=</template>
          {{ totalPhe }} mg Phe
        </span>
        <span v-if="kcalReference" class="flex-1 text-lg">= {{ totalKcal }} {{ $t('common.kcal') }}</span>
      </div>

      <PrimaryButton
        :text="$t('common.add')"
        :loading="isSaving"
        :loading-text="$t('common.saving')"
        @click="save"
      />
    </div>

    <p class="mt-4 text-gray-600 dark:text-gray-400 italic text-sm">
      {{ $t('ai-calculator.disclaimer') }}
    </p>
  </div>
</template>
