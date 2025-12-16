<script setup>
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, push, update } from 'firebase/database'
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { getApp } from 'firebase/app'
import { format } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const config = useRuntimeConfig()
const localePath = useLocalePath()
const notifications = useNotifications()

// Reactive state
const phe = ref(null)
const protein = ref(null)
const weight = ref(null)
const name = ref('')
const kcalReference = ref(null)
const select = ref('phe')
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isEstimating = ref(false)

// Constants
// Base estimate "credits" per day for premium users.
// Non-premium users get a lower effective limit via computed config.
const BASE_DAILY_ESTIMATE_LIMIT = 20
const FREE_USER_DAILY_ESTIMATE_LIMIT = 2

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)
const isPremium = computed(() => store.settings.license === config.public.pkutoolsLicenseKey)
const settings = computed(() => store.settings)
// Premium users can choose to use Gemini 2.5 Pro (higher quality, higher cost per estimate)
// or stick with Gemini 2.5 Flash (more estimates). This is a simple per-session toggle.
const useProEstimatesSetting = ref(false)

// Configuration for the AI model, cost per estimate and daily limit
// estimationCount is treated as "credits used" per day.
const estimateConfig = computed(() => {
  // Free users: always flash model, 2 estimates/day
  if (!isPremium.value) {
    return {
      model: 'gemini-2.5-flash',
      dailyLimitCredits: FREE_USER_DAILY_ESTIMATE_LIMIT,
      costPerEstimate: 1
    }
  }

  // Premium users: toggle between more estimates with flash or better quality with pro
  if (useProEstimatesSetting.value) {
    // Pro: uses more credits per estimate so effective estimates/day = 2
    return {
      model: 'gemini-2.5-pro',
      dailyLimitCredits: BASE_DAILY_ESTIMATE_LIMIT,
      costPerEstimate: 10
    }
  }

  // Premium + flash: full 20 estimates/day
  return {
    model: 'gemini-2.5-flash',
    dailyLimitCredits: BASE_DAILY_ESTIMATE_LIMIT,
    costPerEstimate: 1
  }
})

// Human-readable daily limit in "number of estimates"
const humanDailyEstimateLimit = computed(() => {
  const { dailyLimitCredits, costPerEstimate } = estimateConfig.value
  return Math.floor(dailyLimitCredits / costPerEstimate)
})

// Remaining number of full estimates the user can make today
const remainingEstimates = computed(() => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.value.estimationDate
  const currentCount = estimateDate === today ? settings.value.estimationCount || 0 : 0
  const { dailyLimitCredits, costPerEstimate } = estimateConfig.value
  const remainingCredits = Math.max(0, dailyLimitCredits - currentCount)
  return Math.floor(remainingCredits / costPerEstimate)
})

const type = computed(() => [
  { title: t('phe-calculator.phe'), value: 'phe' },
  { title: t('phe-calculator.other'), value: 'other' },
  { title: t('phe-calculator.meat'), value: 'meat' },
  { title: t('phe-calculator.vegetable'), value: 'vegetable' },
  { title: t('phe-calculator.fruit'), value: 'fruit' }
])

const factor = computed(() => {
  if (select.value === 'fruit') {
    return 27
  } else if (select.value === 'vegetable') {
    return 35
  } else if (select.value === 'meat') {
    return 46
  } else if (select.value === 'other') {
    return 50
  } else {
    return null
  }
})

// Methods
const calculatePhe = () => {
  if (select.value === 'phe') {
    return Math.round((weight.value * phe.value) / 100) || 0
  } else {
    // Proteinmodus
    return Math.round((weight.value * (protein.value * factor.value)) / 100) || 0
  }
}

const calculateKcal = () => {
  return Math.round((weight.value * kcalReference.value) / 100) || 0
}

// Check daily estimate count (without incrementing)
const checkDailyLimit = () => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.value.estimationDate
  const currentCount = estimateDate === today ? settings.value.estimationCount || 0 : 0
  const { dailyLimitCredits, costPerEstimate } = estimateConfig.value

  // Projected credits after one more estimate
  const projectedCredits = currentCount + costPerEstimate

  if (projectedCredits > dailyLimitCredits) {
    return { allowed: false, remaining: 0 }
  }

  const remainingCredits = dailyLimitCredits - currentCount
  const remainingEstimates = Math.floor(remainingCredits / costPerEstimate)
  return { allowed: true, remaining: remainingEstimates }
}

// Increment daily estimate count (only after successful API call)
const incrementDailyLimit = async () => {
  const db = getDatabase()
  const today = format(new Date(), 'yyyy-MM-dd')
  const estimateDate = settings.value.estimationDate
  const currentCount = estimateDate === today ? settings.value.estimationCount || 0 : 0
  const { costPerEstimate } = estimateConfig.value

  // Update count and date in Firebase
  await update(dbRef(db, `${user.value.id}/settings`), {
    estimationCount: currentCount + costPerEstimate,
    estimationDate: today
  })
}

const estimateFoodValues = async () => {
  if (!name.value || name.value.trim() === '') {
    notifications.error(t('phe-calculator.estimate-error-no-name'))
    return
  }

  // Sanitize input to prevent prompt injection
  const sanitizedName = name.value
    .trim()
    .slice(0, 200) // Limit length
    .replace(/"/g, '\\"') // Escape quotes to prevent breaking out of string
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\r/g, '') // Remove carriage returns
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .trim() // Trim again after replacements

  // Check daily limit (before making API call)
  const limitCheck = checkDailyLimit()
  if (!limitCheck.allowed) {
    notifications.error(
      t('phe-calculator.estimate-error-daily-limit', { limit: humanDailyEstimateLimit.value })
    )
    return
  }

  let firebaseApp
  try {
    firebaseApp = getApp()
  } catch {
    notifications.error(t('phe-calculator.estimate-error-firebase'))
    return
  }

  isEstimating.value = true

  try {
    // Initialize the Gemini Developer API backend service
    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })

    // Create a GenerativeModel instance with structured output support
    const { model: modelName } = estimateConfig.value
    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })

    // Create a prompt that requests structured JSON output
    const prompt = `Estimate the nutritional values for the following food: "${sanitizedName}"

Please provide a JSON response with the following structure:
{
  "phePer100g": <number in mg per 100g>,
  "kcalPer100g": <number in kcal per 100g>,
  "proteinPer100g": <number in g per 100g>,
  "servingSizeGrams": <number in grams for a typical serving size>
}

Important:
- phePer100g should be the phenylalanine content in milligrams per 100 grams
- kcalPer100g should be the caloric content in kilocalories per 100 grams
- proteinPer100g should be the protein content in grams per 100 grams
- servingSizeGrams should be a typical serving size in grams
- If you cannot determine a value, use null for that field
- Provide realistic estimates based on typical nutritional databases
- For processed foods, provide values for the prepared/cooked state unless specified otherwise`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const foodData = JSON.parse(jsonMatch[0])

    // Update the form fields with estimated values
    // Check if values are valid numbers before using them
    if (
      foodData.phePer100g !== null &&
      foodData.phePer100g !== undefined &&
      !isNaN(Number(foodData.phePer100g))
    ) {
      phe.value = Math.round(Number(foodData.phePer100g))
      select.value = 'phe'
    } else if (
      foodData.proteinPer100g !== null &&
      foodData.proteinPer100g !== undefined &&
      !isNaN(Number(foodData.proteinPer100g))
    ) {
      protein.value = Math.round(Number(foodData.proteinPer100g) * 10) / 10 // Round to 1 decimal
      select.value = 'other'
    }

    if (
      foodData.kcalPer100g !== null &&
      foodData.kcalPer100g !== undefined &&
      !isNaN(Number(foodData.kcalPer100g))
    ) {
      kcalReference.value = Math.round(Number(foodData.kcalPer100g))
    }

    if (
      foodData.servingSizeGrams !== null &&
      foodData.servingSizeGrams !== undefined &&
      !isNaN(Number(foodData.servingSizeGrams)) &&
      Number(foodData.servingSizeGrams) > 0
    ) {
      weight.value = Math.round(Number(foodData.servingSizeGrams))
    }

    // Only increment count after successful API call and validation
    await incrementDailyLimit() // Increment daily count

    notifications.success(t('phe-calculator.estimate-success'))
  } catch (error) {
    console.error('Error estimating food values:', error)

    // Check for quota/rate limit errors
    const errorMessage = error?.message || error?.error?.message || ''
    const errorType = error?.type || error?.error?.type || ''

    if (
      errorType === 'RESOURCE_EXHAUSTED' ||
      errorMessage.includes('quota') ||
      errorMessage.includes('Quota exceeded') ||
      errorMessage.includes('rate limit')
    ) {
      // Don't increment count for quota errors - the API call didn't succeed
      notifications.error(t('phe-calculator.estimate-error-quota'))
    } else {
      notifications.error(t('phe-calculator.estimate-error'))
    }
  } finally {
    isEstimating.value = false
  }
}

const save = () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  const db = getDatabase()
  let logEntry
  if (select.value === 'phe') {
    logEntry = {
      name: name.value,
      pheReference: phe.value,
      kcalReference: Number(kcalReference.value) || 0,
      weight: Number(weight.value),
      phe: calculatePhe(),
      kcal: calculateKcal()
    }
  } else {
    logEntry = {
      name: name.value,
      pheReference: Math.round(protein.value * factor.value),
      kcalReference: Number(kcalReference.value) || 0,
      weight: Number(weight.value),
      phe: calculatePhe(),
      kcal: calculateKcal()
    }
  }

  // Find entry for selected date or create new one
  const formattedDate = selectedDate.value
  const dateEntry = store.pheDiary.find((entry) => entry.date === formattedDate)

  if (dateEntry) {
    const updatedLog = [...(dateEntry.log || []), logEntry]
    const totalPhe = updatedLog.reduce((sum, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum, item) => sum + (item.kcal || 0), 0)
    update(dbRef(db, `${user.value.id}/pheDiary/${dateEntry['.key']}`), {
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })
  } else {
    if (
      store.pheDiary.length >= 14 &&
      store.settings.license !== config.public.pkutoolsLicenseKey
    ) {
      notifications.error(t('app.limit'))
    } else {
      push(dbRef(db, `${user.value.id}/pheDiary`), {
        date: formattedDate,
        phe: calculatePhe(),
        kcal: calculateKcal(),
        log: [logEntry]
      })
    }
  }
  navigateTo(localePath('diary'))
}

definePageMeta({
  i18n: {
    paths: {
      en: '/phe-calculator',
      de: '/phe-rechner',
      es: '/calculadora-phe',
      fr: '/calculateur-phe'
    }
  }
})

useSeoMeta({
  title: () => t('phe-calculator.title'),
  description: () => t('phe-calculator.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('phe-calculator.title') + ' - PKU Tools',
  description: () => t('phe-calculator.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <div v-if="userIsAuthenticated" class="block mb-6">
      <nav class="flex flex-wrap gap-1 justify-center" aria-label="Tabs">
        <NuxtLink
          :to="$localePath('phe-calculator')"
          class="inline-flex items-center gap-2 bg-black/5 dark:bg-white/15 text-gray-700 rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300"
          aria-current="page"
        >
          <LucideCalculator class="h-5 w-5" /> {{ $t('app.calculator') }}
        </NuxtLink>
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
      </nav>
    </div>

    <header>
      <PageHeader :title="$t('phe-calculator.title')" />
    </header>

    <div v-if="userIsAuthenticated" class="flex gap-4">
      <TextInput
        v-model="name"
        id-name="food"
        :label="$t('common.food-name')"
        class="flex-1 [&>div:last-child]:mb-0"
      />
      <div class="flex items-center mt-7 h-9">
        <button
          type="button"
          class="rounded-sm bg-sky-500 px-2 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-full flex items-center"
          :disabled="isEstimating || !name || name.trim() === '' || remainingEstimates === 0"
          @click="estimateFoodValues"
        >
          <span v-if="isEstimating">{{ $t('phe-calculator.estimating') }}</span>
          <span v-else>{{ $t('phe-calculator.estimate') }}</span>
        </button>
      </div>
    </div>

    <div v-if="userIsAuthenticated" class="mt-1 text-xs text-gray-600 dark:text-gray-400">
      {{
        $t(isPremium ? 'phe-calculator.estimate-info-premium' : 'phe-calculator.estimate-info', {
          limit: humanDailyEstimateLimit
        })
      }}
    </div>

    <div
      v-if="userIsAuthenticated && isPremium"
      class="mt-2 text-xs text-gray-600 dark:text-gray-400 max-w-xl"
    >
      <label class="inline-flex items-start gap-2 cursor-pointer select-none">
        <input
          id="use-pro-estimates"
          v-model="useProEstimatesSetting"
          type="checkbox"
          class="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
        />
        <span>{{ $t('phe-calculator.use-pro-model') }}</span>
      </label>
    </div>

    <div v-if="userIsAuthenticated" class="flex gap-4 mt-4">
      <div class="flex-1">
        <SelectMenu v-model="select" id-name="factor" :label="$t('phe-calculator.mode')">
          <option v-for="option in type" :key="option.value" :value="option.value">
            {{ option.title }}
          </option>
        </SelectMenu>
      </div>
      <DateInput v-model="selectedDate" id-name="date" :label="$t('common.date')" class="flex-1" />
    </div>

    <SelectMenu
      v-if="!userIsAuthenticated"
      v-model="select"
      id-name="factor"
      :label="$t('phe-calculator.mode')"
    >
      <option v-for="option in type" :key="option.value" :value="option.value">
        {{ option.title }}
      </option>
    </SelectMenu>

    <div class="flex gap-4">
      <NumberInput
        v-if="select === 'phe'"
        v-model.number="phe"
        id-name="phe"
        :label="$t('common.phe-per-100g')"
        class="flex-1"
      />
      <NumberInput
        v-else
        v-model.number="protein"
        id-name="protein"
        :label="$t('common.protein-per-100g')"
        class="flex-1"
      />
      <NumberInput
        v-model.number="kcalReference"
        id-name="kcalRef"
        :label="$t('common.kcal-per-100g')"
        class="flex-1"
        :placeholder="$t('common.optional')"
      />
    </div>
    <NumberInput v-model.number="weight" id-name="weight" :label="$t('common.consumed-weight')" />

    <div class="flex gap-4 my-6">
      <span class="flex-1 ml-1 text-lg">
        <template v-if="select === 'phe'">= {{ calculatePhe() }} mg Phe</template>
        <template v-else>≈ {{ calculatePhe() }} mg Phe</template>
      </span>
      <span class="flex-1 ml-1 text-lg">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
    </div>

    <PrimaryButton v-if="userIsAuthenticated" :text="$t('common.add')" @click="save" />
  </div>
</template>
