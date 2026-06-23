<script setup>
import { useStore } from '../../stores/index'
import { QrcodeStream } from 'vue-qrcode-reader'
import { format } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const { addFoodItemToDiary } = useApi()
const { ensureEmojiForLogEntry } = useFoodEmoji()

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

// Camera selection.
// The bare `facingMode: 'environment'` default lets the OS pick any rear lens, and
// on multi-camera phones that is often the ultra-wide or macro lens, which can't
// focus close enough to read a barcode. We resolve a concrete deviceId for the
// main rear camera instead. `advanced` requests continuous autofocus on top of
// that (best-effort; silently ignored where unsupported, e.g. iOS Safari).
const buildConstraints = (base) => ({ ...base, advanced: [{ focusMode: 'continuous' }] })
const constraints = ref(buildConstraints({ facingMode: { ideal: 'environment' } }))
// deviceId of the chosen rear camera, resolved once and reused for later opens.
let resolvedRearCameraId = null

// Camera labels are localized to the device language (iOS) so we match across the
// app's locales (en/de/es/fr) instead of English only. REAR_RE flags rear-facing
// cameras; FRONT_RE excludes selfie cameras that REAR_RE might otherwise catch.
const REAR_RE = /\b(back|rear|environment)\b|rück|ruck|tras|posterior|arrière|arriere|hinten/i
const FRONT_RE = /\bfront\b|frontal|avant|delantera|vorder|selfie/i

// Rank a rear camera by its label: prefer the general-purpose main lens, avoid the
// lenses that can't focus on a close barcode (ultra-wide, telephoto, macro, depth).
const scoreRearCamera = (label = '') => {
  const l = label.toLowerCase()
  let score = 0
  // Lenses that can't focus on a close barcode. These tokens are stable across
  // locales (ultra/macro) or listed with their common translations.
  if (/ultra/.test(l)) score -= 100 // ultra-wide
  if (/tele|télé/.test(l)) score -= 80 // telephoto / téléobjectif / teleobjetivo
  if (/macro|makro/.test(l)) score -= 60
  if (/depth|tiefe|profond|profund|infra|truedepth|monochrom/.test(l)) score -= 200
  // Android's main sensor is the index-0 back camera.
  if (/\b0,?\s*facing back\b/.test(l)) score += 1000
  // Tie-break: prefer the plainest label. The generic auto-switching rear camera
  // has the shortest name in every language (en "Back Camera", de "Rückkamera"),
  // so a shorter label wins over qualified ones like "… Dual Wide Camera".
  score -= l.length
  return score
}

// Pick the best rear camera, or null when there's nothing meaningful to choose
// (labels hidden until permission is granted, or a single rear lens — in which
// case the facingMode default already targets it).
const isRearCamera = (label) => !!label && REAR_RE.test(label) && !FRONT_RE.test(label)

const pickRearCamera = (videoInputs) => {
  const rear = videoInputs.filter((d) => isRearCamera(d.label))
  if (rear.length <= 1) return null
  const ranked = [...rear].sort((a, b) => scoreRearCamera(b.label) - scoreRearCamera(a.label))
  return ranked[0]?.deviceId ?? null
}

// Point `constraints` at the main rear camera. Device labels are only readable once
// camera permission has been granted, so this is a no-op on the very first open and
// is retried from @camera-on once the stream (and labels) are available.
const resolveCamera = async () => {
  if (resolvedRearCameraId) {
    constraints.value = buildConstraints({ deviceId: { exact: resolvedRearCameraId } })
    return
  }
  if (!navigator.mediaDevices?.enumerateDevices) return
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const id = pickRearCamera(devices.filter((d) => d.kind === 'videoinput'))
    if (id) {
      resolvedRearCameraId = id
      constraints.value = buildConstraints({ deviceId: { exact: id } })
    }
  } catch {
    // enumerateDevices failed — keep the facingMode fallback.
  }
}

// ---------------------------------------------------------------------------
// TEMP DEBUG (remove after camera testing): surfaces the camera enumeration,
// the per-lens scores and the lens we actually picked, directly in the UI so it
// can be verified on a released build without USB remote debugging.
// ---------------------------------------------------------------------------
const debug = ref({ pickedId: '', constraints: '', devices: [], capabilities: '' })
const shortId = (id) => (id ? id.slice(0, 10) + '…' : '—')

const captureCameraDebug = async (capabilities) => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices.filter((d) => d.kind === 'videoinput')
    debug.value = {
      pickedId: resolvedRearCameraId || '',
      constraints: JSON.stringify(constraints.value),
      capabilities: capabilities
        ? JSON.stringify(capabilities, null, 2)
        : debug.value.capabilities,
      devices: videoInputs.map((d) => ({
        id: shortId(d.deviceId),
        fullId: d.deviceId,
        label: d.label,
        score: isRearCamera(d.label) ? scoreRearCamera(d.label) : null,
        chosen: !!resolvedRearCameraId && d.deviceId === resolvedRearCameraId
      }))
    }
  } catch (e) {
    debug.value.capabilities = 'enumerate failed: ' + (e?.message || e)
  }
}

const copyDebug = async () => {
  const text = JSON.stringify(
    {
      pickedId: debug.value.pickedId,
      constraints: debug.value.constraints,
      devices: debug.value.devices.map((d) => ({
        label: d.label,
        id: d.fullId,
        score: d.score,
        chosen: d.chosen
      })),
      capabilities: debug.value.capabilities
    },
    null,
    2
  )
  try {
    await navigator.clipboard.writeText(text)
    notifications.success('Debug info copied')
  } catch {
    notifications.error('Copy failed — select the text manually')
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

const factor = computed(() => {
  if (select.value === 'fruit') {
    return 27
  } else if (select.value === 'vegetable') {
    return 35
  } else if (select.value === 'meat') {
    return 46
  } else {
    return 50
  }
})

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

const onReady = async (capabilities) => {
  loaded.value = true
  // First successful grant: labels are now readable. If this phone exposes several
  // rear lenses, lock onto the main one (the default may have opened the ultra-wide
  // or macro lens). Cached, so this only triggers a one-time switch on first scan.
  if (!resolvedRearCameraId) await resolveCamera()
  // TEMP DEBUG: refresh the on-screen diagnostics with the now-active camera.
  captureCameraDebug(capabilities)
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
      `https://world.openfoodfacts.org/api/v2/product/${scannedCode}.json`
    )
    // A real product has status 1 and a product object; keep result null
    // otherwise so the template (and calc helpers) never deref result.product.
    if (response?.status === 1 && response.product) {
      result.value = response
      // Success: close the dialog and show the product on the page.
      cancel()
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
  // A cached deviceId can go stale (camera reassigned/unplugged). Drop it and fall
  // back to the generic rear camera once, rather than surfacing a hard error.
  if (err.name === 'OverconstrainedError' && constraints.value.deviceId) {
    resolvedRearCameraId = null
    constraints.value = buildConstraints({ facingMode: { ideal: 'environment' } })
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
  // Show the dialog (and its loading spinner) immediately, then resolve the camera
  // before mounting the stream so a known main lens is used from the first frame.
  dialog.value.openDialog()
  await resolveCamera()
  open.value = true
}

const cancel = () => {
  paused.value = true
  loaded.value = false
  open.value = false
  dialog.value.closeDialog()
}

const calculatePhe = () => {
  return Math.round(
    (weight.value * (result.value.product.nutriments.proteins_100g * factor.value)) / 100
  )
}

const calculateKcal = () => {
  return Math.round((weight.value * result.value.product.nutriments['energy-kcal_100g']) / 100) || 0
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  let logEntry = {
    name: result.value.product.product_name,
    emoji: null,
    icon: null,
    pheReference: Math.round(result.value.product.nutriments.proteins_100g * factor.value),
    kcalReference: result.value.product.nutriments['energy-kcal_100g'] || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal(),
    note: null
  }

  isSaving.value = true

  // Use server API for all writes - validates with Zod
  try {
    logEntry = await ensureEmojiForLogEntry(logEntry)

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

defineOgImage('NuxtSeo', {
  title: () => t('barcode-scanner.title') + ' - PKU Tools',
  description: () => t('barcode-scanner.description'),
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
          class="bg-black/5 dark:bg-white/15 text-gray-700 rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
          aria-current="page"
        >
          <LucideScanBarcode class="h-5 w-5" />
          <span class="hidden sm:inline">{{ $t('app.scanner') }}</span>
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

      <!-- TEMP DEBUG: camera selection diagnostics — remove after testing -->
      <div
        class="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-3 text-left font-mono text-[11px] leading-relaxed text-gray-100"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-amber-400">CAMERA DEBUG</span>
          <button
            type="button"
            class="rounded bg-gray-700 px-2 py-0.5 text-gray-100 hover:bg-gray-600"
            @click="copyDebug"
          >
            Copy
          </button>
        </div>
        <p class="break-all">
          picked: {{ debug.pickedId ? shortId(debug.pickedId) : '(none — facingMode default)' }}
        </p>
        <p class="break-all">constraints: {{ debug.constraints }}</p>
        <p class="mt-2">cameras ({{ debug.devices.length }}):</p>
        <ul class="space-y-0.5">
          <li
            v-for="d in debug.devices"
            :key="d.fullId"
            :class="d.chosen ? 'text-green-400' : ''"
          >
            {{ d.chosen ? '✓' : '·' }} [{{ d.score === null ? '—' : d.score }}]
            {{ d.label || '(label hidden — grant permission)' }}
            <span class="text-gray-500">{{ d.id }}</span>
          </li>
        </ul>
        <p class="mt-2">active capabilities:</p>
        <pre class="whitespace-pre-wrap break-all text-gray-300">{{ debug.capabilities || '—' }}</pre>
      </div>

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

    <div v-if="result">
      <img
        v-if="result.product.image_small_url"
        :src="result.product.image_small_url"
        max-height="200"
        max-width="200"
        class="my-6"
      />

      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-3 mb-1">
        {{ result.product.product_name }}
      </h2>

      <!-- Do not remove -->
      <p v-if="code !== ''" class="text-sm mb-6">Code: {{ code }}</p>

      <div v-if="result.product.nutriments?.proteins_100g != null">
        <p class="text-xl mb-1">
          {{ result.product.nutriments.proteins_100g }}
          {{ result.product.nutriments.proteins_unit }}
          {{ $t('common.short-protein-per-100g') }}
        </p>
        <p v-if="result.product.nutriments['energy-kcal_100g']" class="text-sm mb-6">
          {{ result.product.nutriments['energy-kcal_100g'] || 0 }}
          {{ $t('common.kcal-per-100g') }}
        </p>

        <DateInput
          v-if="userIsAuthenticated"
          v-model="selectedDate"
          id-name="date"
          :label="$t('common.date')"
        />

        <SelectMenu v-model="select" id-name="factor" :label="$t('common.food-type')">
          <option v-for="option in type" :key="option.value" :value="option.value">
            {{ option.title }}
          </option>
        </SelectMenu>

        <NumberInput
          v-model.number="weight"
          id-name="weight"
          :label="$t('common.consumed-weight')"
          class="mb-6"
        />

        <p class="text-xl mb-1">≈ {{ calculatePhe() }} mg Phe</p>
        <p v-if="result.product.nutriments['energy-kcal_100g']" class="text-sm mb-6">
          = {{ calculateKcal() }} {{ $t('common.kcal') }}
        </p>

        <PrimaryButton
          v-if="userIsAuthenticated"
          :text="$t('common.add')"
          :loading="isSaving"
          :loading-text="$t('common.saving')"
          @click="save"
        />
      </div>

      <div v-if="result.product.nutriments?.proteins_100g == null" class="mb-6">
        <p>{{ $t('barcode-scanner.no-protein') }}</p>
        <NuxtLink :to="$localePath('phe-calculator')" class="text-sky-500">
          {{ $t('barcode-scanner.protein-link') }} <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>
    </div>

    <p class="mt-4 text-gray-600 dark:text-gray-400 italic text-sm">
      {{ $t('barcode-scanner.info') }}
    </p>
    <p class="mt-2 text-gray-600 dark:text-gray-400 italic text-sm">
      {{ $t('barcode-scanner.info-2') }}
    </p>
  </div>
</template>
