<script setup>
import { useStore } from '../../stores/index'
import { format } from 'date-fns'
import { pheFactor, roundReference, scaleToWeight } from '../utils/nutrition'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()
const notifications = useNotifications()
const { addFoodItemToDiary } = useApi()
const { saveAlongsideDiary, reportSaved } = useSaveToOwnFood()
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

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)

const type = computed(() => [
  { title: t('phe-calculator.phe'), value: 'phe' },
  { title: t('phe-calculator.other'), value: 'other' },
  { title: t('phe-calculator.meat'), value: 'meat' },
  { title: t('phe-calculator.vegetable'), value: 'vegetable' },
  { title: t('phe-calculator.fruit'), value: 'fruit' }
])

// Null in direct-Phe mode, where no protein conversion happens at all
const factor = computed(() => (select.value === 'phe' ? null : pheFactor(select.value)))

// Per-100 g Phe the entry is calculated from. In protein mode it is derived
// from protein × factor; the result below is computed from this exact value, so
// re-opening the entry in the diary recalculates to the same number.
const pheReference = computed(() => {
  if (select.value === 'phe') return Number(phe.value) || 0
  const derived = Number(protein.value) * factor.value
  return Number.isFinite(derived) ? roundReference(derived) : 0
})

// Methods
const calculatePhe = () => scaleToWeight(pheReference.value, weight.value)

const calculateKcal = () => scaleToWeight(Number(kcalReference.value), weight.value)

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

  let logEntry = {
    name: name.value,
    emoji: emoji.value || null,
    icon: null,
    pheReference: pheReference.value,
    kcalReference: Number(kcalReference.value) || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note: null,
    source: 'manual',
    // Protein mode: keep what the Phe was derived from, so the entry stays
    // self-explaining (and the factor is available for a later feature)
    ...(select.value !== 'phe' && {
      nutrients: { protein: Number(protein.value) },
      factor: factor.value
    })
  }

  // The intent, taken before the emoji lookup awaits below. The form stays
  // editable while that request is in flight, and both records have to describe
  // the food the button was pressed for — not a half-edited one.
  const shouldSaveToOwnFood = saveToOwnFood.value
  const shouldShareWithCommunity = shareWithCommunity.value
  // The date picker stays editable too, and the entry belongs to the day that
  // was selected when the button was pressed
  const entryDate = selectedDate.value
  // The note is whatever the field shows, so it can only ever describe the food
  // in front of the user
  const entryNote = shouldSaveToOwnFood && note.value?.trim() ? note.value.trim() : null
  if (shouldSaveToOwnFood) logEntry.note = entryNote

  isSaving.value = true

  // Reported together with the diary entry below, rather than as a failure of
  // the whole save
  let ownFoodOutcome = null

  // Use server API for all writes - validates with Zod
  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

    // In protein mode the stored reference is the converted value, the same
    // number the diary entry is calculated from — what it was converted from
    // travels with it, so the food stays self-explaining. Both come from the
    // entry above, so the two records can never disagree.
    if (shouldSaveToOwnFood) {
      ownFoodOutcome = await saveAlongsideDiary({
        name: logEntry.name,
        icon: null,
        emoji: logEntry.emoji || null,
        phe: logEntry.pheReference,
        kcal: logEntry.kcalReference,
        note: entryNote,
        shared: shouldShareWithCommunity,
        source: 'manual',
        ...(logEntry.nutrients && { nutrients: logEntry.nutrients }),
        ...(logEntry.factor && { factor: logEntry.factor })
      })
    }

    await addFoodItemToDiary({
      date: entryDate,
      ...logEntry
    })
    reportSaved(ownFoodOutcome)
    // Navigate after successful save
    navigateTo(localePath('diary'))
  } catch (error) {
    // The food is already in Own Food, so a retry must not save it a second
    // time. Unticking happens here rather than the moment it was written: on the
    // way to a successful save the option would collapse under the user while
    // the diary write is still running.
    if (ownFoodOutcome && !ownFoodOutcome.failure) {
      saveToOwnFood.value = false
      shareWithCommunity.value = false
    }
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

defineOgImage('Default', {
  title: () => t('phe-calculator.title') + ' - PKU Tools',
  description: () => t('phe-calculator.description')
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
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideSparkles class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.ai-calculator') }}</span>
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

    <SaveToOwnFood
      v-if="userIsAuthenticated"
      v-model="saveToOwnFood"
      v-model:note="note"
      v-model:shared="shareWithCommunity"
      :hint="select === 'phe' ? null : $t('phe-calculator.check-mode')"
    />

    <PrimaryButton
      v-if="userIsAuthenticated"
      :text="$t('common.add')"
      :loading="isSaving"
      :loading-text="$t('common.saving')"
      @click="save"
    />
  </div>
</template>
