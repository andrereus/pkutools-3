<script setup>
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, push, update } from 'firebase/database'
import { QrcodeStream } from 'vue-qrcode-reader'
import { format } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const config = useRuntimeConfig()
const localePath = useLocalePath()

// Reactive state
const loaded = ref(false)
const open = ref(false)
const paused = ref(false)
const code = ref('')
const error = ref('')
const result = ref(null)
const weight = ref(100)
const select = ref('other')

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)

const type = computed(() => [
  { title: t('protein-calculator.other'), value: 'other' },
  { title: t('protein-calculator.meat'), value: 'meat' },
  { title: t('protein-calculator.vegetable'), value: 'vegetable' },
  { title: t('protein-calculator.fruit'), value: 'fruit' }
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
    ctx.strokeStyle = '#007bff'
    ctx.strokeRect(x, y, width, height)
  }
}

const onReady = () => {
  loaded.value = true
}

const onDetect = async (detectedCodes) => {
  paused.value = true
  code.value = detectedCodes[0].rawValue

  try {
    const response = await fetch(
      'https://world.openfoodfacts.org/api/v2/product/' + code.value + '.json'
    )
    if (!response.ok) {
      throw new Error(response.status)
    }
    result.value = await response.json()
  } catch (error) {
    alert(t('barcode-scanner.error'))
    console.log(error)
  }
  cancel()
}

const onError = (err) => {
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

const openDialog = () => {
  paused.value = false
  open.value = true
  dialog.value.openDialog()
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

const save = () => {
  const db = getDatabase()
  const logEntry = {
    name: result.value.product.product_name,
    pheReference: Math.round(result.value.product.nutriments.proteins_100g * factor.value),
    kcalReference: result.value.product.nutriments['energy-kcal_100g'] || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  const today = new Date()
  const formattedDate = format(today, 'yyyy-MM-dd')
  const todayEntry = store.pheDiary.find((entry) => entry.date === formattedDate)

  if (todayEntry) {
    const updatedLog = [...(todayEntry.log || []), logEntry]
    const totalPhe = updatedLog.reduce((sum, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum, item) => sum + (item.kcal || 0), 0)
    update(dbRef(db, `${user.value.id}/pheDiary/${todayEntry['.key']}`), {
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })
  } else {
    if (
      store.pheDiary.length >= 50 &&
      store.settings.license !== config.public.pkutoolsLicenseKey
    ) {
      alert(t('app.limit'))
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
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('app.scanner')" />
    </header>

    <PrimaryButton :text="$t('barcode-scanner.scan-barcode')" @click="openDialog" class="mt-2" />

    <SimpleDialog ref="dialog" :title="$t('barcode-scanner.scan-barcode')" @close="cancel">
      <p v-if="loaded === false">{{ $t('barcode-scanner.please-wait') }}</p>

      <!-- Do not remove -->
      <p v-if="error !== ''">{{ error }}</p>

      <QrcodeStream
        v-if="open"
        :paused="paused"
        :track="paintBoundingBox"
        :formats="['ean_13', 'ean_8']"
        @camera-on="onReady"
        @detect="onDetect"
        @error="onError"
      ></QrcodeStream>
    </SimpleDialog>

    <div v-if="result">
      <img
        v-if="result.product.image_small_url"
        :src="result.product.image_small_url"
        max-height="200"
        max-width="200"
        class="my-6"
      />

      <h2 class="text-2xl mt-3 mb-1">{{ result.product.product_name }}</h2>

      <!-- Do not remove -->
      <p v-if="code !== ''" class="text-sm mb-6">Code: {{ code }}</p>

      <div v-if="result.product.nutriments.proteins_100g">
        <p class="text-xl mb-1">
          {{ result.product.nutriments.proteins_100g }}
          {{ result.product.nutriments.proteins_unit }}
          {{ $t('common.short-protein-per-100g') }}
        </p>
        <p v-if="result.product.nutriments['energy-kcal_100g']" class="text-sm mb-6">
          {{ result.product.nutriments['energy-kcal_100g'] || 0 }}
          {{ $t('common.kcal-per-100g') }}
        </p>

        <SelectMenu id-name="factor" :label="$t('common.food-type')" v-model="select">
          <option v-for="option in type" :key="option.value" :value="option.value">
            {{ option.title }}
          </option>
        </SelectMenu>

        <NumberInput
          id-name="weight"
          :label="$t('common.consumed-weight')"
          v-model.number="weight"
          class="mb-6"
        />

        <p class="text-xl mb-1">≈ {{ calculatePhe() }} mg Phe</p>
        <p v-if="result.product.nutriments['energy-kcal_100g']" class="text-sm mb-6">
          = {{ calculateKcal() }} {{ $t('common.kcal') }}
        </p>

        <PrimaryButton v-if="userIsAuthenticated" :text="$t('common.add')" @click="save" />
      </div>

      <div v-if="!result.product.nutriments.proteins_100g" class="mb-6">
        <p>{{ $t('barcode-scanner.no-protein') }}</p>
        <NuxtLink :to="$localePath('protein-calculator')" class="text-sky-500">
          {{ $t('barcode-scanner.protein-link') }} <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>
    </div>

    <p class="mt-2">
      {{ $t('barcode-scanner.info') }}
    </p>
  </div>
</template>
