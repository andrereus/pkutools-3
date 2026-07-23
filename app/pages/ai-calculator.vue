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

const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    notifications.error(t('app.auth-error'))
    console.error(error)
  }
}

// Reactive state
const mode = ref('estimate') // 'estimate' | 'label'
const description = ref('')
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isEstimating = ref(false)
const isReadingLabel = ref(false)
const isSaving = ref(false)
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)
const labelImageFile = ref(null)
const labelFileInputRef = ref(null)
const labelFoodType = ref('other')
const correctionDialog = ref(null)
const correctionHint = ref('')

// Result state
const result = ref(null) // { name, emoji, phePer100g, proteinPer100g, kcalPer100g, weightInGrams, explanation }
const weight = ref(null)

// Constants
const ESTIMATE_MODEL = 'gemini-3.5-flash'
const BASE_DAILY_ESTIMATE_LIMIT = 20
const PREMIUM_AI_DAILY_ESTIMATE_LIMIT = 100
const FREE_USER_DAILY_ESTIMATE_LIMIT = 3
const MAX_IMAGE_DIMENSION = 1024
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024 // 15MB

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const settings = computed(() => store.settings)

// Total estimates available per day for the current tier (not the remaining count)
const dailyEstimateLimit = computed(() => {
  if (!isPremium.value) return FREE_USER_DAILY_ESTIMATE_LIMIT
  if (isPremiumAI.value) return PREMIUM_AI_DAILY_ESTIMATE_LIMIT
  return BASE_DAILY_ESTIMATE_LIMIT
})

const remainingEstimates = computed(() => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.value.estimationDate
  const currentCount = estimateDate === today ? settings.value.estimationCount || 0 : 0
  return Math.max(0, dailyEstimateLimit.value - currentCount)
})

const isBusy = computed(() => isEstimating.value || isReadingLabel.value)

const isLabelResult = computed(() => result.value?.source === 'label')

const labelFoodTypes = computed(() => [
  { title: t('phe-calculator.other'), value: 'other' },
  { title: t('phe-calculator.meat'), value: 'meat' },
  { title: t('phe-calculator.vegetable'), value: 'vegetable' },
  { title: t('phe-calculator.fruit'), value: 'fruit' }
])

const labelFactor = computed(() => {
  if (labelFoodType.value === 'fruit') {
    return 27
  } else if (labelFoodType.value === 'vegetable') {
    return 35
  } else if (labelFoodType.value === 'meat') {
    return 46
  } else {
    return 50
  }
})

// Computed Phe: use phePer100g directly, or fall back to protein × factor
// (selectable food type factor for label results, general 50 for estimates)
const pheReference = computed(() => {
  if (!result.value) return 0
  if (result.value.phePer100g !== null && !isNaN(result.value.phePer100g)) {
    return Math.round(result.value.phePer100g)
  }
  if (result.value.proteinPer100g !== null && !isNaN(result.value.proteinPer100g)) {
    const factor = isLabelResult.value ? labelFactor.value : 50
    return Math.round(result.value.proteinPer100g * factor)
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

const sanitizePromptInput = (value) =>
  (value || '')
    .trim()
    .slice(0, 500)
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .trim()

// Checks the daily quota via server API and returns a ready-to-use model, or null
const requestAiModel = async () => {
  const auth = getAuth()
  const currentUser = auth.currentUser
  if (!currentUser) {
    notifications.error(t('phe-calculator.estimate-error-firebase'))
    return null
  }

  const token = await currentUser.getIdToken()

  const checkResponse = await $fetch('/api/gemini/check', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!checkResponse.allowed) {
    notifications.error(
      t('phe-calculator.estimate-error-daily-limit', { limit: checkResponse.remaining })
    )
    return null
  }

  let firebaseApp
  try {
    firebaseApp = getApp()
  } catch {
    notifications.error(t('phe-calculator.estimate-error-firebase'))
    return null
  }

  const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: ESTIMATE_MODEL,
    generationConfig: { responseMimeType: 'application/json' }
  })
}

const notifyAiError = (error) => {
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
}

const appLanguageName = () => {
  const languageMap = { en: 'English', de: 'German', es: 'Spanish', fr: 'French' }
  return languageMap[locale.value] || 'English'
}

const estimateFoodValues = async () => {
  if (isBusy.value) return

  isEstimating.value = true
  const previousResult = result.value
  result.value = null

  try {
    const hasText = description.value && description.value.trim() !== ''
    const hasImage = !!imageFile.value

    if (!hasText && !hasImage) {
      notifications.error(t('phe-calculator.estimate-error-no-input'))
      return
    }

    const sanitizedText = sanitizePromptInput(description.value)
    const sanitizedCorrection = sanitizePromptInput(correctionHint.value)
    const hasCorrection = sanitizedCorrection !== '' && previousResult !== null

    const model = await requestAiModel()
    if (!model) return

    const appLanguage = appLanguageName()

    const previousEstimate = hasCorrection ? JSON.stringify(previousResult) : ''

    const prompt = `Identify the food(s) and estimate (combined) nutritional values. Consider all provided inputs together (text description and/or image). Use ${appLanguage} for values. Use null for unknown values. Base estimates on typical nutritional databases. Cross-check that phePer100g is plausible relative to proteinPer100g.${hasText ? `\n\nText description: "${sanitizedText}"` : ''}${hasCorrection ? `\n\nPrevious estimate: ${previousEstimate}\nUser correction: "${sanitizedCorrection}"` : ''}

Return JSON:
{
  "name": string (short descriptive name) or null,
  "phePer100g": number (phenylalanine in mg per 100g) or null,
  "kcalPer100g": number (calories in kcal per 100g) or null,
  "proteinPer100g": number (protein in g per 100g) or null,
  "weightInGrams": number (total weight or typical serving size in g) or null,
  "emoji": string (exactly one emoji character) or null,
  "explanation": string (maximum 140 characters) or null
}`

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
      source: 'estimate',
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
      weightInGrams:
        foodData.weightInGrams !== null &&
        foodData.weightInGrams !== undefined &&
        !isNaN(Number(foodData.weightInGrams)) &&
        Number(foodData.weightInGrams) > 0
          ? Math.round(Number(foodData.weightInGrams))
          : null,
      explanation:
        foodData.explanation &&
        typeof foodData.explanation === 'string' &&
        foodData.explanation.trim() !== ''
          ? foodData.explanation.trim()
          : null
    }

    // Set editable weight from serving size
    weight.value = result.value.weightInGrams || 100

    // Clear correction hint after a successful re-estimate
    correctionHint.value = ''

    notifications.success(t('phe-calculator.estimate-success'))
  } catch (error) {
    console.error('Error estimating food values:', error)
    notifyAiError(error)
  } finally {
    isEstimating.value = false
  }
}

const parseLabelNumber = (value, decimals) => {
  if (value === null || value === undefined || isNaN(Number(value))) return null
  const factor = 10 ** decimals
  return Math.round(Number(value) * factor) / factor
}

const readLabel = async () => {
  if (isBusy.value || !labelImageFile.value) return

  isReadingLabel.value = true
  result.value = null

  try {
    const model = await requestAiModel()
    if (!model) return

    const prompt = `Read the nutrition facts label in the image. Extract only values printed on the label. Do not estimate or guess missing values. If values are printed per serving or per portion only, convert them to per 100g using the printed serving size. If energy is printed only in kJ, convert it to kcal. If phenylalanine is printed in g, convert it to mg.

Return JSON:
{
  "isNutritionLabel": boolean (true only if the image shows a nutrition facts label),
  "proteinPer100g": number (protein in g per 100g) or null,
  "kcalPer100g": number (energy in kcal per 100g) or null,
  "phePer100g": number (phenylalanine in mg per 100g, ONLY if phenylalanine is explicitly printed on the label) or null,
  "servingSizeInGrams": number (serving size in g if printed) or null
}`

    const base64Data = await resizeAndConvertToBase64(labelImageFile.value)
    const aiResult = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
    ])
    const text = aiResult.response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const labelData = JSON.parse(jsonMatch[0])

    const phePer100g = parseLabelNumber(labelData.phePer100g, 0)
    const proteinPer100g = parseLabelNumber(labelData.proteinPer100g, 1)
    const kcalPer100g = parseLabelNumber(labelData.kcalPer100g, 0)
    const servingSize = parseLabelNumber(labelData.servingSizeInGrams, 0)

    if (labelData.isNutritionLabel !== true || (phePer100g === null && proteinPer100g === null)) {
      notifications.error(t('ai-calculator.label-error'))
      return
    }

    result.value = {
      source: 'label',
      name: '',
      emoji: null,
      phePer100g,
      proteinPer100g,
      kcalPer100g,
      weightInGrams: servingSize && servingSize > 0 ? servingSize : null,
      explanation: null
    }

    weight.value = result.value.weightInGrams || 100
    labelFoodType.value = 'other'

    notifications.success(t('ai-calculator.label-success'))
  } catch (error) {
    console.error('Error reading label:', error)
    notifyAiError(error)
  } finally {
    isReadingLabel.value = false
  }
}

const onLabelImageSelected = async (event) => {
  const file = event.target.files?.[0]
  if (labelFileInputRef.value) labelFileInputRef.value.value = ''
  if (!file) return
  if (!isPremium.value) {
    notifications.error(t('phe-calculator.image-premium-only'))
    return
  }
  if (!file.type.startsWith('image/')) {
    notifications.error(t('phe-calculator.estimate-error-invalid-image'))
    return
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    notifications.error(t('phe-calculator.estimate-error-image-too-large'))
    return
  }
  labelImageFile.value = file
  correctionHint.value = ''
  await readLabel()
}

const openCorrectionDialog = () => {
  correctionHint.value = ''
  correctionDialog.value?.openDialog()
}

const submitCorrection = async () => {
  if (!correctionHint.value || correctionHint.value.trim() === '') return
  correctionDialog.value?.closeDialog()
  await estimateFoodValues()
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
  theme: '#0ea5e9'
})
</script>

<template>
  <div>
    <div v-if="userIsAuthenticated" class="block mb-6">
      <nav class="flex gap-3 justify-center" aria-label="Tabs">
        <NuxtLink
          :to="$localePath('food-search')"
          :title="$t('app.search')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideSearch class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.search') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="$localePath('barcode-scanner')"
          :title="$t('app.scanner')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideScanBarcode class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.scanner') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="$localePath('ai-calculator')"
          :title="$t('app.ai-calculator')"
          class="bg-black/5 dark:bg-white/15 text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
          aria-current="page"
        >
          <LucideSparkles class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.ai-calculator') }}</span>
        </NuxtLink>
        <NuxtLink
          :to="$localePath('phe-calculator')"
          :title="$t('app.calculator')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideCalculator class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.calculator') }}</span>
        </NuxtLink>
      </nav>
    </div>

    <PageHeader :title="$t('ai-calculator.title')" />

    <div v-if="!userIsAuthenticated">
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ $t('ai-calculator.description') }}</p>
      <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
      <br />
      <NuxtLink
        type="button"
        :to="$localePath('sign-in')"
        class="rounded-full bg-black/5 dark:bg-white/15 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400 mr-3 mb-6"
      >
        {{ $t('sign-in.signin-with-email') }}
      </NuxtLink>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="onImageSelected"
    />

    <input
      ref="labelFileInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="onLabelImageSelected"
    />

    <div v-if="userIsAuthenticated" class="mt-2">
      <div class="inline-flex rounded-full bg-black/5 dark:bg-white/10 p-1 mb-4">
        <button
          type="button"
          class="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            mode === 'estimate'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          "
          :aria-pressed="mode === 'estimate'"
          :disabled="isBusy"
          @click="mode = 'estimate'"
        >
          {{ $t('ai-calculator.mode-estimate') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            mode === 'label'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          "
          :aria-pressed="mode === 'label'"
          :disabled="isBusy"
          @click="mode = 'label'"
        >
          {{ $t('ai-calculator.mode-label') }}
        </button>
      </div>

      <template v-if="mode === 'estimate'">
        <label
          for="description"
          class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
        >
          {{ $t('ai-calculator.input-label') }}
        </label>
        <div class="mt-1">
          <textarea
            id="description"
            v-auto-grow
            v-model="description"
            rows="1"
            :placeholder="$t('ai-calculator.input-placeholder')"
            :disabled="isBusy"
            class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
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
              :aria-label="$t('phe-calculator.remove-photo')"
              @click="removeImage"
            >
              <LucideX class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 mt-3">
          <button
            type="button"
            class="rounded-full bg-black/5 px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-xs hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:bg-white/15 dark:text-gray-300 dark:hover:bg-white/10 dark:focus-visible:outline-gray-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-9 flex items-center"
            :disabled="isBusy"
            :title="$t('phe-calculator.add-photo')"
            @click="
              isPremium
                ? fileInputRef?.click()
                : notifications.error(t('phe-calculator.image-premium-only'))
            "
          >
            <LucideCamera class="h-5 w-5" />
            <span class="ml-1">{{ $t('ai-calculator.analyze-photo') }}</span>
          </button>
          <button
            type="button"
            class="rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-9 flex items-center"
            :disabled="
              isBusy ||
              ((!description || description.trim() === '') && !imageFile) ||
              remainingEstimates === 0
            "
            @click="estimateFoodValues"
          >
            <span v-if="isEstimating">{{ $t('phe-calculator.estimating') }}</span>
            <span v-else>{{ $t('phe-calculator.estimate') }}</span>
          </button>
        </div>
      </template>

      <div v-else>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('ai-calculator.label-info') }}
        </p>
        <button
          type="button"
          class="mt-3 rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-9 flex items-center"
          :disabled="isBusy || remainingEstimates === 0"
          @click="
            isPremium
              ? labelFileInputRef?.click()
              : notifications.error(t('phe-calculator.image-premium-only'))
          "
        >
          <span>
            <template v-if="isReadingLabel">{{ $t('ai-calculator.reading-label') }}</template>
            <template v-else>{{ $t('ai-calculator.read-label') }}</template>
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="result"
      class="mt-6 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
    >
      <div class="flex items-start justify-between gap-3 mb-4">
        <h2 v-if="!isLabelResult" class="text-xl font-semibold text-gray-900 dark:text-white">
          <span v-if="result.emoji">{{ result.emoji }}&nbsp;</span>{{ result.name }}
        </h2>
        <div v-else class="flex-1">
          <TextInput
            v-model="result.name"
            id-name="food-name"
            :label="$t('common.food-name')"
            :placeholder="$t('ai-calculator.name-placeholder')"
          />
        </div>
        <button
          v-if="!isLabelResult"
          type="button"
          class="shrink-0 inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-xs hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:bg-white/15 dark:text-gray-300 dark:hover:bg-white/10 dark:focus-visible:outline-gray-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          :disabled="isBusy || remainingEstimates === 0"
          :title="$t('ai-calculator.correct-title')"
          @click="openCorrectionDialog"
        >
          <LucidePencil class="h-4 w-4" />
          <span>{{ $t('ai-calculator.correct') }}</span>
        </button>
      </div>

      <div
        v-if="result.explanation"
        class="text-sm text-gray-600 dark:text-gray-400 italic break-words mb-4"
      >
        {{ result.explanation }}
      </div>

      <div v-if="isLabelResult" class="flex gap-4 text-gray-600 dark:text-gray-400 mb-4">
        <span v-if="result.phePer100g !== null" class="flex-1"
          >{{ result.phePer100g }} {{ $t('common.mg-phe-per-100g') }}</span
        >
        <span v-if="result.proteinPer100g !== null" class="flex-1"
          >{{ result.proteinPer100g }} {{ $t('common.g-protein-per-100g') }}</span
        >
        <span v-if="kcalReference" class="flex-1"
          >{{ kcalReference }} {{ $t('common.kcal-per-100g') }}</span
        >
      </div>
      <div v-else class="flex gap-4 text-gray-600 dark:text-gray-400 mb-4">
        <span class="flex-1">{{ pheReference }} {{ $t('common.mg-phe-per-100g') }}</span>
        <span v-if="kcalReference" class="flex-1"
          >{{ kcalReference }} {{ $t('common.kcal-per-100g') }}</span
        >
      </div>

      <div
        v-if="isProteinFallback && !isLabelResult"
        class="text-xs text-amber-600 dark:text-amber-400 mb-3"
      >
        {{ $t('ai-calculator.protein-fallback-note') }}
      </div>

      <DateInput v-model="selectedDate" id-name="date" :label="$t('common.date')" />

      <SelectMenu
        v-if="isLabelResult && result.phePer100g === null"
        v-model="labelFoodType"
        id-name="food-type"
        :label="$t('common.food-type')"
      >
        <option v-for="option in labelFoodTypes" :key="option.value" :value="option.value">
          {{ option.title }}
        </option>
      </SelectMenu>

      <NumberInput
        v-model.number="weight"
        id-name="weight"
        :label="$t('ai-calculator.serving-size')"
      />

      <div class="flex gap-4 my-4">
        <span class="flex-1 text-lg">
          <template v-if="isProteinFallback && !isLabelResult">≈</template>
          <template v-else>=</template>
          {{ totalPhe }} mg Phe
        </span>
        <span v-if="kcalReference" class="flex-1 text-lg"
          >= {{ totalKcal }} {{ $t('common.kcal') }}</span
        >
      </div>

      <PrimaryButton
        :text="$t('common.add')"
        :loading="isSaving"
        :loading-text="$t('common.saving')"
        :disabled="isLabelResult && !result.name?.trim()"
        @click="save"
      />
    </div>

    <ModalDialog
      ref="correctionDialog"
      :title="$t('ai-calculator.correct-title')"
      :buttons="[
        {
          label: $t('ai-calculator.re-estimate'),
          type: 'submit',
          visible: true
        },
        { label: $t('common.cancel'), type: 'simpleClose', visible: true }
      ]"
      :loading="isBusy"
      @submit="submitCorrection"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {{ $t('ai-calculator.correct-description') }}
      </p>
      <textarea
        v-model="correctionHint"
        rows="3"
        :disabled="isBusy"
        class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
      />
    </ModalDialog>

    <p v-if="userIsAuthenticated" class="mt-4 text-gray-600 dark:text-gray-400 italic text-sm">
      {{ mode === 'label' ? $t('ai-calculator.disclaimer-label') : $t('ai-calculator.disclaimer') }}
    </p>
    <p v-if="userIsAuthenticated" class="mt-2 text-gray-600 dark:text-gray-400 italic text-sm">
      {{ $t('ai-calculator.disclaimer-2') }}
    </p>

    <p v-if="userIsAuthenticated && !isPremium" class="mt-6 text-sm">
      <NuxtLink :to="$localePath('settings')">
        <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
        {{ $t('ai-calculator.trial-limit') }} ({{
          $t('ai-calculator.estimates-per-day', { count: dailyEstimateLimit })
        }})
      </NuxtLink>
    </p>
    <p v-if="isPremium && !isPremiumAI" class="mt-6 text-sm">
      <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
      {{ $t('ai-calculator.premium-limit') }} ({{
        $t('ai-calculator.estimates-per-day', { count: dailyEstimateLimit })
      }})
    </p>
    <p v-if="isPremiumAI" class="mt-6 text-sm">
      <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
      {{ $t('ai-calculator.premium-ai-limit') }}
    </p>
  </div>
</template>
