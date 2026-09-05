<script setup>
import { useStore } from '../../stores/index'
import { QrcodeStream } from 'vue-qrcode-reader'
import { format } from 'date-fns'
import {
  pheFactor,
  roundReference,
  scaleToWeight,
  nutrientRows,
  isReported
} from '../utils/nutrition'
import { foodTypeFromCategories } from '../utils/food-category'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const { addFoodItemToDiary } = useApi()
const { saveAlongsideDiary, reportSaved } = useSaveToOwnFood()
const { ensureEmojiForLogEntry } = useFoodEmoji()
const { suggestFoodType } = useFoodTypeSuggestion()

// Reactive state
const loaded = ref(false)
const open = ref(false)
const paused = ref(false)
const code = ref('')
const error = ref('')
// The most recent barcode whose lookup failed, shown with a "scan again" action.
const lastFailedCode = ref('')
// True while a product lookup is in flight (drives the in-dialog spinner).
const looking = ref(false)
const result = ref(null)
const weight = ref(100)
const select = ref('other')
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))
const isSaving = ref(false)
const saveToOwnFood = ref(false)
const shareWithCommunity = ref(false)
const note = ref(null)
// Open Food Facts has products with nutriments but no name. The name is what
// every entry is found by later, so it is asked for rather than guessed.
const nameOverride = ref('')
// A conservative suggestion from the product's categories. It never changes
// the calculation until the user explicitly applies it: Open Food Facts is
// community-edited, and a lower factor must not silently lower the Phe result.
const categorySuggestion = ref(null)
// Which evidence the suggestion above rests on: the product's own categories,
// or — when those say nothing — the product name alone. Only the sentence the
// user reads differs; neither source applies itself.
const suggestionSource = ref('category')
// Invalidates a pending name suggestion after any manual choice.
let typeChoices = 0

// Camera selection.
// The MediaDevices API exposes no lens metadata, so there's no reliable way to
// detect which rear lens can focus on a barcode (ultra-wide/macro lenses can't).
// Instead the user picks from a dropdown when the device has more than one camera;
// we default to the OS choice (facingMode: environment) and remember the selection.
const CAMERA_STORAGE_KEY = 'barcode_camera'
const LEGACY_CAMERA_STORAGE_KEY = 'pku-barcode-camera'
const cameras = ref([]) // [{ deviceId, label }]
const selectedCameraId = ref('') // '' = OS default, otherwise a specific deviceId

// `advanced` requests continuous autofocus on top of the chosen camera (best-effort;
// silently ignored where unsupported, e.g. iOS Safari). The library deep-watches
// this, so changing the selection re-acquires the camera.
const constraints = computed(() => {
  const base = selectedCameraId.value
    ? { deviceId: { exact: selectedCameraId.value } }
    : { facingMode: { ideal: 'environment' } }
  return { ...base, advanced: [{ focusMode: 'continuous' }] }
})

// Persist the choice (including '' for "default") so it survives across visits.
watch(selectedCameraId, (id) => {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, id)
  } catch {
    // storage unavailable (e.g. private mode) — the choice just won't persist
  }
})

// Restore the remembered camera. Guarded for SSR (no localStorage on the server).
onMounted(() => {
  try {
    // Carry a saved camera choice to the current key.
    const legacy = localStorage.getItem(LEGACY_CAMERA_STORAGE_KEY)
    if (legacy !== null && localStorage.getItem(CAMERA_STORAGE_KEY) === null) {
      localStorage.setItem(CAMERA_STORAGE_KEY, legacy)
    }
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_CAMERA_STORAGE_KEY)
    }
    selectedCameraId.value = localStorage.getItem(CAMERA_STORAGE_KEY) || ''
  } catch {
    // ignore
  }
})

// Populate the dropdown before opening and again when the stream is ready. Device
// labels are available after permission has been granted; until then use fallbacks.
const refreshCameras = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) return
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `${t('barcode-scanner.camera')} ${i + 1}`
      }))
    // A remembered camera can disappear (unplugged / id rotated) — fall back to default.
    if (
      selectedCameraId.value &&
      !cameras.value.some((c) => c.deviceId === selectedCameraId.value)
    ) {
      selectedCameraId.value = ''
    }
  } catch {
    // ignore — the dropdown just won't populate
  }
}

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)

const type = computed(() => [
  { title: t('phe-calculator.other'), value: 'other' },
  { title: t('phe-calculator.meat'), value: 'meat' },
  { title: t('phe-calculator.vegetable'), value: 'vegetable' },
  { title: t('phe-calculator.fruit'), value: 'fruit' }
])

const factor = computed(() => pheFactor(select.value))

const categorySuggestionLabel = computed(
  () => type.value.find((option) => option.value === categorySuggestion.value)?.title || ''
)

// A suggestion from the product name, fetched only when the categories yielded
// nothing. It is deliberately not awaited by the scan: the product is on screen
// straight away, and the box appears underneath it when the answer arrives. A
// suggestion that only repeats the active type is dropped rather than shown.
const suggestFromName = async (forCode, foodName) => {
  const choicesWhenAsked = typeChoices
  const suggested = await suggestFoodType(foodName)
  // Drop the result when the scan or selection changed while it was pending.
  if (code.value !== forCode || !result.value) return
  if (typeChoices !== choicesWhenAsked) return
  if (!suggested || suggested === select.value || categorySuggestion.value) return
  suggestionSource.value = 'name'
  categorySuggestion.value = suggested
}

const applyCategorySuggestion = () => {
  if (!categorySuggestion.value) return
  select.value = categorySuggestion.value
  categorySuggestion.value = null
}

// A manual choice overrides every pending or visible suggestion.
const selectFoodType = (foodType) => {
  typeChoices += 1
  select.value = foodType
  categorySuggestion.value = null
}

// Methods
const paintBoundingBox = (detectedCodes, ctx) => {
  for (const detectedCode of detectedCodes) {
    const {
      boundingBox: { x, y, width, height }
    } = detectedCode

    ctx.lineWidth = 2
    ctx.strokeStyle = '#0ea5e9'
    ctx.strokeRect(x, y, width, height)
  }
}

const onReady = () => {
  loaded.value = true
  // Camera permission is now granted, so device labels are readable — populate the
  // picker (no-op'd to a single entry, and hidden, on single-camera devices).
  refreshCameras()
}

const onDetect = async (detectedCodes) => {
  const scannedCode = detectedCodes[0]?.rawValue
  // Look up the first detected code immediately — a clean single-frame read is
  // enough. Freeze the camera right away; the `looking` guard ignores any stray
  // detect that races the pause.
  if (!scannedCode || looking.value) return

  paused.value = true
  looking.value = true
  error.value = ''
  code.value = scannedCode

  try {
    const response = await $fetch(
      `https://world.openfoodfacts.org/api/v3/product/${scannedCode}.json?fields=product_name,nutriments,image_small_url,categories_tags`
    )
    // v3 reports found products as "success" or "success_with_warnings", so
    // don't match on "success" alone. Keep result null on failure so the
    // template (and calc helpers) never deref result.product.
    if (response?.status?.startsWith('success') && response.product) {
      result.value = response
      // A new product is a new decision — the own-food option starts unchecked
      // rather than carrying over from the product scanned before it.
      saveToOwnFood.value = false
      shareWithCommunity.value = false
      note.value = null
      nameOverride.value = ''
      // Every product starts on the general factor, which is the highest one.
      // A definite category is offered separately and only affects the result
      // after the user accepts it; the previous product's choice never carries
      // over silently.
      select.value = 'other'
      suggestionSource.value = 'category'
      categorySuggestion.value = foodTypeFromCategories(response.product.categories_tags)
      // Success: close the dialog and show the product on the page.
      cancel()
      // Where the categories name a type, that is the suggestion. Where they
      // leave it open, the name is asked instead — a product Open Food Facts
      // publishes no name for has nothing to ask about.
      if (!categorySuggestion.value && response.product.product_name) {
        suggestFromName(scannedCode, response.product.product_name)
      }
      return
    }
    showLookupError(scannedCode, t('barcode-scanner.error-not-found'))
  } catch (err) {
    // Open Food Facts returns 404 for unknown barcodes; treat anything else as
    // a real lookup/network failure.
    const status = err?.statusCode ?? err?.response?.status
    showLookupError(
      scannedCode,
      status === 404 ? t('barcode-scanner.error-not-found') : t('barcode-scanner.error')
    )
    console.error(err)
  } finally {
    looking.value = false
  }
}

// A lookup failed. The camera stays frozen (paused) showing the captured frame;
// we surface the code + message and the user resumes via "scan again". No
// auto-rescanning, which on awkward surfaces tends to pick up misread numbers.
const showLookupError = (scannedCode, message) => {
  result.value = null
  error.value = message
  lastFailedCode.value = scannedCode
}

const scanAgain = () => {
  // Resume the frozen camera. loaded=false shows the camera-loading spinner
  // until the stream is reacquired and @camera-on (onReady) fires.
  error.value = ''
  lastFailedCode.value = ''
  loaded.value = false
  paused.value = false
}

const onError = (err) => {
  // A selected deviceId can go stale (camera unplugged / id rotated). Fall back to
  // the OS default once, rather than surfacing a hard error.
  if (err.name === 'OverconstrainedError' && selectedCameraId.value) {
    selectedCameraId.value = ''
    return
  }

  let translationKey = ''
  switch (err.name) {
    case 'NotAllowedError':
      translationKey = 'barcode-scanner.error-camera-permission'
      break
    case 'NotFoundError':
      translationKey = 'barcode-scanner.error-no-camera'
      break
    case 'NotSupportedError':
      translationKey = 'barcode-scanner.error-not-supported'
      break
    case 'NotReadableError':
      translationKey = 'barcode-scanner.error-not-readable'
      break
    case 'OverconstrainedError':
      translationKey = 'barcode-scanner.error-overconstrained'
      break
    case 'StreamApiNotSupportedError':
      translationKey = 'barcode-scanner.error-stream-api'
      break
    case 'InsecureContextError':
      translationKey = 'barcode-scanner.error-insecure-context'
      break
    default:
      translationKey = 'barcode-scanner.error-generic'
  }
  error.value = t(translationKey, { message: err.message })
}

const openDialog = async () => {
  paused.value = false
  loaded.value = false
  error.value = ''
  lastFailedCode.value = ''
  looking.value = false
  // Show the dialog (and its loading spinner) immediately, then refresh the camera
  // list so the picker is pre-populated if permission was granted on a prior visit.
  dialog.value.openDialog()
  await refreshCameras()
  open.value = true
}

const cancel = () => {
  paused.value = true
  loaded.value = false
  open.value = false
  dialog.value.closeDialog()
}

const nutriments = computed(() => result.value?.product?.nutriments || {})

// What the product is called: what Open Food Facts publishes, or what the user
// typed when it publishes nothing
const productName = computed(() => {
  const published = result.value?.product?.product_name
  return typeof published === 'string' && published.trim() !== ''
    ? published.trim()
    : nameOverride.value.trim()
})

// Open Food Facts publishes protein, not Phe, so the per-100 g reference is
// derived from protein × factor. The result is computed from this exact value,
// so re-opening the entry in the diary recalculates to the same number.
const pheReference = computed(() => {
  const protein = nutriments.value.proteins_100g
  if (!isReported(protein)) return 0
  return roundReference(Number(protein) * factor.value)
})

// The common nutrients the product carries, per 100 g. Absent ones are left
// out rather than stored as null.
const scannedNutrients = computed(() => {
  const fields = {
    protein: nutriments.value.proteins_100g,
    fat: nutriments.value.fat_100g,
    carbs: nutriments.value.carbohydrates_100g,
    sugar: nutriments.value.sugars_100g,
    fiber: nutriments.value.fiber_100g,
    salt: nutriments.value.salt_100g
  }
  const available = Object.entries(fields).filter(([, value]) => isReported(value))
  if (available.length === 0) return null
  return Object.fromEntries(available.map(([key, value]) => [key, Number(value)]))
})

const productNutrientRows = computed(() => nutrientRows(scannedNutrients.value, weight.value, t))

const calculatePhe = () => scaleToWeight(pheReference.value, weight.value)

const calculateKcal = () =>
  scaleToWeight(Number(nutriments.value['energy-kcal_100g']), weight.value)

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  if (!productName.value) {
    notifications.error(t('errors.validation.required', { field: t('common.food-name') }))
    return
  }

  let logEntry = {
    name: productName.value,
    emoji: null,
    icon: null,
    pheReference: pheReference.value,
    kcalReference: nutriments.value['energy-kcal_100g'] || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note: null,
    source: 'barcode',
    // The barcode is a real product identifier, so it can match this entry
    // against the same product scanned elsewhere later
    sourceId: code.value || null,
    factor: factor.value,
    ...(scannedNutrients.value && { nutrients: scannedNutrients.value })
  }

  // The intent, taken before the emoji lookup awaits below. A scan can land
  // while that request is in flight and would replace the product underneath
  // it; both records have to describe the one the button was pressed for.
  const shouldSaveToOwnFood = saveToOwnFood.value
  const shouldShareWithCommunity = shareWithCommunity.value
  // The date picker stays editable too, and the entry belongs to the day that
  // was selected when the button was pressed
  const entryDate = selectedDate.value
  // The note is whatever the field shows, so it can only ever describe the
  // product in front of the user
  const entryNote = shouldSaveToOwnFood && note.value?.trim() ? note.value.trim() : null
  if (shouldSaveToOwnFood) logEntry.note = entryNote

  isSaving.value = true

  // Reported together with the diary entry below, rather than as a failure of
  // the whole save
  let ownFoodOutcome = null

  // Use server API for all writes - validates with Zod
  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

    // The stored reference is the converted value; the protein it came from,
    // the factor and the barcode travel with it, so a later scan of the same
    // product recognises the food instead of saving it a second time. All of it
    // comes from the entry above, so the two records can never disagree.
    if (shouldSaveToOwnFood) {
      ownFoodOutcome = await saveAlongsideDiary({
        name: logEntry.name,
        icon: null,
        emoji: logEntry.emoji || null,
        phe: logEntry.pheReference,
        kcal: Number(logEntry.kcalReference) || 0,
        note: entryNote,
        shared: shouldShareWithCommunity,
        source: 'barcode',
        sourceId: logEntry.sourceId,
        factor: logEntry.factor,
        ...(logEntry.nutrients && { nutrients: logEntry.nutrients })
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
    console.error('Save error:', error)
  } finally {
    isSaving.value = false
  }
}

definePageMeta({
  i18n: {
    paths: {
      en: '/barcode-scanner',
      de: '/barcode-scanner',
      es: '/escaner-codigo-barras',
      fr: '/scanner-code-barres'
    }
  }
})

useSeoMeta({
  title: () => t('barcode-scanner.title'),
  description: () => t('barcode-scanner.description')
})

defineOgImage('Default', {
  title: () => t('barcode-scanner.title') + ' - PKU Tools',
  description: () => t('barcode-scanner.description')
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
          class="bg-black/5 dark:bg-white/15 text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
          aria-current="page"
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
          class="text-gray-500 hover:text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
        >
          <LucideCalculator class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.calculator') }}</span>
        </NuxtLink>
      </nav>
    </div>

    <header>
      <PageHeader :title="$t('barcode-scanner.title')" />
    </header>

    <PrimaryButton :text="$t('barcode-scanner.scan-barcode')" class="mt-2" @click="openDialog" />
    <SecondaryButton
      :text="$t('ai-calculator.read-label')"
      class="mt-2"
      @click="navigateTo(localePath('ai-calculator') + '?mode=label')"
    />

    <ModalDialog
      ref="dialog"
      :title="$t('barcode-scanner.scan-barcode')"
      :buttons="[{ type: 'close', label: $t('common.cancel') }]"
      @close="cancel"
    >
      <p
        v-if="loaded === false"
        class="inline-flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400"
      >
        <LucideLoaderCircle class="h-4 w-4 animate-spin" />
        {{ $t('barcode-scanner.please-wait') }}
      </p>

      <!-- Do not remove -->
      <!-- Camera errors only; lookup failures are shown grouped below. -->
      <p
        v-if="error !== '' && !lastFailedCode"
        role="alert"
        class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20"
      >
        {{ error }}
      </p>

      <SelectMenu
        v-if="open && cameras.length > 1"
        v-model="selectedCameraId"
        id-name="camera"
        :label="$t('barcode-scanner.camera-select')"
      >
        <option value="">{{ $t('barcode-scanner.camera-default') }}</option>
        <option v-for="cam in cameras" :key="cam.deviceId" :value="cam.deviceId">
          {{ cam.label }}
        </option>
      </SelectMenu>

      <QrcodeStream
        v-if="open"
        :paused="paused"
        :constraints="constraints"
        :track="paintBoundingBox"
        :formats="['ean_13', 'ean_8']"
        @camera-on="onReady"
        @detect="onDetect"
        @error="onError"
      />

      <!-- Lookup in progress -->
      <p
        v-if="looking"
        class="mt-4 inline-flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400"
      >
        <LucideLoaderCircle class="h-4 w-4 animate-spin" />
        {{ $t('barcode-scanner.looking-up') }}
      </p>

      <!-- Last lookup failed: message + the code that was read, grouped, + retry. -->
      <div v-else-if="lastFailedCode" class="mt-4">
        <div
          role="alert"
          class="rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20"
        >
          <p>{{ error }}</p>
          <p class="mt-0.5 font-mono text-red-700/70 dark:text-red-300/70">
            Code: {{ lastFailedCode }}
          </p>
        </div>
        <SecondaryButton :text="$t('barcode-scanner.scan-again')" class="mt-3" @click="scanAgain" />
      </div>
    </ModalDialog>

    <div
      v-if="result"
      class="mt-6 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
    >
      <img
        v-if="result.product.image_small_url"
        :src="result.product.image_small_url"
        max-height="200"
        max-width="200"
        class="mb-4"
      />

      <h2
        v-if="result.product.product_name"
        class="text-xl font-semibold text-gray-900 dark:text-white mb-1"
      >
        {{ result.product.product_name }}
      </h2>

      <!-- Open Food Facts knows the product but not its name: without one there
           is nothing to log, so it is asked for instead of failing on save. -->
      <TextInput
        v-else
        v-model="nameOverride"
        id-name="product-name"
        :label="$t('common.food-name')"
        :placeholder="$t('barcode-scanner.no-name')"
      />

      <!-- Do not remove -->
      <p v-if="code !== ''" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Code: {{ code }}
      </p>

      <div v-if="isReported(result.product.nutriments?.proteins_100g)">
        <div class="flex gap-4 text-gray-600 dark:text-gray-400 mb-4">
          <span class="flex-1">
            {{ result.product.nutriments.proteins_100g }}
            {{ result.product.nutriments.proteins_unit }}
            {{ $t('common.short-protein-per-100g') }}
          </span>
          <span v-if="result.product.nutriments['energy-kcal_100g']" class="flex-1">
            {{ result.product.nutriments['energy-kcal_100g'] || 0 }}
            {{ $t('common.kcal-per-100g') }}
          </span>
        </div>

        <DateInput
          v-if="userIsAuthenticated"
          v-model="selectedDate"
          id-name="date"
          :label="$t('common.date')"
        />

        <SelectMenu
          :model-value="select"
          id-name="factor"
          :label="$t('common.food-type')"
          @update:model-value="selectFoodType"
        >
          <option v-for="option in type" :key="option.value" :value="option.value">
            {{ option.title }}
          </option>
        </SelectMenu>

        <!-- A category or a name is a suggestion, not evidence. Keep the
             conservative general factor active until the user chooses this. -->
        <div
          v-if="categorySuggestion"
          class="-mt-2 mb-3 rounded-lg bg-sky-50 p-3 text-sm text-gray-700 dark:bg-sky-950/50 dark:text-gray-300"
        >
          <p>
            {{
              $t(
                suggestionSource === 'name'
                  ? 'barcode-scanner.type-suggestion-name'
                  : 'barcode-scanner.type-suggestion',
                { type: categorySuggestionLabel }
              )
            }}
          </p>
          <p class="mt-1">{{ $t('common.check-composition') }}</p>
          <SecondaryButton
            :text="$t('barcode-scanner.use-suggestion')"
            class="mt-2 mr-0! mb-0!"
            @click="applyCategorySuggestion"
          />
        </div>

        <NumberInput
          v-model.number="weight"
          id-name="weight"
          :label="$t('common.consumed-weight')"
        />

        <div class="flex gap-4 my-4">
          <span class="flex-1 text-lg">≈ {{ calculatePhe() }} mg Phe</span>
          <span v-if="result.product.nutriments['energy-kcal_100g']" class="flex-1 text-lg">
            = {{ calculateKcal() }} {{ $t('common.kcal') }}
          </span>
        </div>

        <!-- Nutrient breakdown for the entered weight -->
        <div
          v-if="productNutrientRows.length > 0"
          class="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
        >
          <div v-for="row in productNutrientRows" :key="row.key" class="flex justify-between">
            <span>{{ row.label }}</span>
            <span>{{ row.value }} g</span>
          </div>
        </div>

        <SaveToOwnFood
          v-if="userIsAuthenticated"
          v-model="saveToOwnFood"
          v-model:note="note"
          v-model:shared="shareWithCommunity"
        />

        <PrimaryButton
          v-if="userIsAuthenticated"
          :text="$t('common.add')"
          :loading="isSaving"
          :loading-text="$t('common.saving')"
          :disabled="!productName"
          @click="save"
        />
      </div>

      <p v-if="!isReported(result.product.nutriments?.proteins_100g)">
        {{ $t('barcode-scanner.no-protein') }}
        {{ ' ' }}
        <i18n-t keypath="barcode-scanner.no-protein-link" tag="span" scope="global">
          <template #ai>
            <NuxtLink
              :to="$localePath('ai-calculator') + '?mode=label'"
              class="text-sky-600 dark:text-sky-400 hover:underline"
              >{{ $t('ai-calculator.title') }}</NuxtLink
            >
          </template>
          <template #phe>
            <NuxtLink
              :to="$localePath('phe-calculator')"
              class="text-sky-600 dark:text-sky-400 hover:underline"
              >{{ $t('phe-calculator.title') }}</NuxtLink
            >
          </template>
        </i18n-t>
      </p>
    </div>

    <p class="mt-4 text-gray-600 dark:text-gray-400 italic text-sm">
      {{ $t('barcode-scanner.info') }}
    </p>
  </div>
</template>
