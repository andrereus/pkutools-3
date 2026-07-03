<script setup>
import { useStore } from '../../stores/index'
import { format } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()
const notifications = useNotifications()
const { addFoodItemToDiary, saveOwnFood } = useApi()
const { ensureEmojiForLogEntry } = useFoodEmoji()

// Reactive state
const phe = ref(null)
const protein = ref(null)
const weight = ref(null)
const name = ref('')
const emoji = ref(null)
const kcalReference = ref(null)
const select = ref('phe')
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isSaving = ref(false)
const saveToOwnFood = ref(false)
const shareWithCommunity = ref(false)
const note = ref(null)

// Community sharing rides on the own-food entry, so it can't stay checked alone
watch(saveToOwnFood, (value) => {
  if (!value) shareWithCommunity.value = false
})

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)

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

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Validate required fields client-side so every missing one is reported at
  // once (and so an empty Phe/protein, which would compute to 0 via calculatePhe's
  // `|| 0` and silently log a 0 mg-Phe food, is caught — the server can't, since
  // it only sees the computed value). An explicit 0 is allowed. Messages reuse
  // the same i18n keys as the server, so wording stays consistent and translated.
  const isEmpty = (v) => v === null || v === undefined || v === ''
  const nutritionalValue = select.value === 'phe' ? phe.value : protein.value
  const nutritionalLabel =
    select.value === 'phe' ? 'common.phe-per-100g' : 'common.protein-per-100g'

  const validationErrors = []
  if (!name.value?.trim()) {
    validationErrors.push(t('errors.validation.required', { field: t('common.food-name') }))
  }
  if (isEmpty(nutritionalValue)) {
    validationErrors.push(t('errors.validation.required', { field: t(nutritionalLabel) }))
  }
  if (isEmpty(weight.value) || !(Number(weight.value) > 0)) {
    validationErrors.push(
      t('errors.validation.must-be-positive', { field: t('common.consumed-weight') })
    )
  }
  if (validationErrors.length > 0) {
    notifications.error(validationErrors.join(' '))
    return
  }

  let logEntry
  if (select.value === 'phe') {
    logEntry = {
      name: name.value,
      emoji: emoji.value || null,
      icon: null,
      pheReference: phe.value,
      kcalReference: Number(kcalReference.value) || 0,
      weight: Number(weight.value),
      phe: calculatePhe(),
      kcal: calculateKcal(),
      note: null
    }
  } else {
    logEntry = {
      name: name.value,
      emoji: emoji.value || null,
      icon: null,
      pheReference: Math.round(protein.value * factor.value),
      kcalReference: Number(kcalReference.value) || 0,
      weight: Number(weight.value),
      phe: calculatePhe(),
      kcal: calculateKcal(),
      note: null
    }
  }

  isSaving.value = true

  // Use server API for all writes - validates with Zod
  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

    // Own food only in exact-Phe mode (converted protein values are too
    // imprecise to store as reference values). Saved before the diary entry so
    // a failure (limit reached, community duplicate) aborts the whole save and
    // retrying can't duplicate the diary entry.
    if (select.value === 'phe' && saveToOwnFood.value) {
      const entryNote = note.value && note.value.trim() !== '' ? note.value.trim() : null
      logEntry.note = entryNote
      await saveOwnFood({
        name: logEntry.name,
        icon: null,
        emoji: logEntry.emoji || null,
        phe: Number(phe.value),
        kcal: Number(kcalReference.value) || 0,
        note: entryNote,
        shared: shareWithCommunity.value
      })
      // Uncheck so a retry after a failed diary write doesn't save it twice
      saveToOwnFood.value = false
      shareWithCommunity.value = false
    }

    await addFoodItemToDiary({
      date: selectedDate.value,
      ...logEntry
    })
    notifications.success(t('common.saved'))
    // Navigate after successful save
    navigateTo(localePath('diary'))
  } catch (error) {
    // Error handling is done in useApi composable
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
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

defineOgImage('NuxtSeo', {
  title: () => t('phe-calculator.title') + ' - PKU Tools',
  description: () => t('phe-calculator.description'),
  theme: '#0ea5e9'
})
</script>

<template>
  <div>
    <div v-if="userIsAuthenticated" class="block mb-6">
      <nav class="flex gap-3 justify-center" aria-label="Tabs">
        <NuxtLink
          :to="$localePath('ai-calculator')"
          :title="$t('app.ai-calculator')"
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideSparkles class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.ai-calculator') }}</span>
        </NuxtLink>
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
          :to="$localePath('phe-calculator')"
          :title="$t('app.calculator')"
          class="bg-black/5 dark:bg-white/15 text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
          aria-current="page"
        >
          <LucideCalculator class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.calculator') }}</span>
        </NuxtLink>
      </nav>
    </div>

    <header>
      <PageHeader :title="$t('phe-calculator.title')" />
    </header>

    <TextInput
      v-if="userIsAuthenticated"
      v-model="name"
      id-name="food"
      :label="$t('common.food-name')"
    />

    <div v-if="userIsAuthenticated" class="flex gap-4">
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

    <div v-if="userIsAuthenticated && select === 'phe'" class="mb-6">
      <div class="flex items-start">
        <div class="flex h-6 items-center">
          <input
            id="save-own-food"
            v-model="saveToOwnFood"
            name="save-own-food"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-600 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <div class="ml-3 text-sm leading-6">
          <label for="save-own-food" class="font-medium text-gray-900 dark:text-gray-300">
            {{ $t('phe-calculator.save-to-own-food') }}
          </label>
        </div>
      </div>
      <div v-if="saveToOwnFood" class="mt-3">
        <label
          for="note"
          class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
          >{{ $t('diary.note') }}</label
        >
        <div class="mt-1">
          <textarea
            id="note"
            v-model="note"
            v-auto-grow
            name="note"
            rows="1"
            :placeholder="$t('diary.note-placeholder')"
            class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
          />
        </div>
      </div>
      <div v-if="saveToOwnFood" class="mt-3 flex items-start">
        <div class="flex h-6 items-center">
          <input
            id="share-community"
            v-model="shareWithCommunity"
            name="share-community"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-600 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <div class="ml-3 text-sm leading-6">
          <label for="share-community" class="font-medium text-gray-900 dark:text-gray-300">
            {{ $t('community.share') }}
          </label>
          <p class="text-gray-500 dark:text-gray-400">
            {{ $t('community.shareLanguage', { language: $t('app.language-name') }) }}
          </p>
        </div>
      </div>
    </div>

    <PrimaryButton
      v-if="userIsAuthenticated"
      :text="$t('common.add')"
      :loading="isSaving"
      :loading-text="$t('common.saving')"
      @click="save"
    />
  </div>
</template>
