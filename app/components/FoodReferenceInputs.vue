<script setup>
import {
  foodTypeForFactor,
  pheContradictsConversion,
  pheFactor,
  proteinPheReference
} from '../utils/nutrition'

// Edit converted foods as protein plus type, and all other foods as Phe.
const props = defineProps({
  // Distinguishes the field ids where two dialogs are in the DOM at once.
  idPrefix: { type: String, default: '' },
  // Own Food shows the reference result; portion editors already show a total.
  showResult: { type: Boolean, default: false }
})

const phe = defineModel('phe')
const kcal = defineModel('kcal')
const nutrients = defineModel('nutrients')
const factor = defineModel('factor')

const { t } = useI18n()

const foodTypes = computed(() => [
  { title: t('phe-calculator.other'), value: 'other' },
  { title: t('phe-calculator.meat'), value: 'meat' },
  { title: t('phe-calculator.vegetable'), value: 'vegetable' },
  { title: t('phe-calculator.fruit'), value: 'fruit' }
])

const foodType = computed(() => foodTypeForFactor(factor.value))

const protein = computed(() => nutrients.value?.protein)

// Both conversion fields must be present.
const isDerived = computed(() => foodType.value !== null && protein.value != null)

// Keep the stored conversion fields synchronized.
const applyConversion = (proteinValue, type) => {
  nutrients.value = { ...(nutrients.value || {}), protein: proteinValue }
  factor.value = pheFactor(type)
  phe.value = proteinPheReference(proteinValue, type)
}

// Keep the stored Phe until the user explicitly recalculates.
const storedPheDiffers = computed(() =>
  pheContradictsConversion(phe.value, protein.value, factor.value)
)

const showsResult = computed(() => props.showResult || storedPheDiffers.value)
</script>

<template>
  <template v-if="isDerived">
    <SelectMenu
      :model-value="foodType"
      :id-name="`${idPrefix}food-type`"
      :label="$t('common.food-type')"
      @update:model-value="applyConversion(protein, $event)"
    >
      <option v-for="option in foodTypes" :key="option.value" :value="option.value">
        {{ option.title }}
      </option>
    </SelectMenu>

    <div class="flex gap-4">
      <NumberInput
        :model-value="protein"
        :id-name="`${idPrefix}protein`"
        :label="$t('common.protein-per-100g')"
        class="flex-1"
        @update:model-value="applyConversion($event, foodType)"
      />
      <NumberInput
        v-model="kcal"
        :id-name="`${idPrefix}kcal`"
        :label="$t('common.kcal-per-100g')"
        class="flex-1"
      />
    </div>

    <p v-if="showsResult" class="mt-4 mb-3 ml-1 text-sm">
      ≈ {{ phe }} {{ $t('common.mg-phe-per-100g') }}
    </p>

    <div
      v-if="storedPheDiffers"
      class="mt-2 mb-3 rounded-lg bg-amber-50 p-3 text-sm text-gray-700 dark:bg-amber-950/40 dark:text-gray-300"
    >
      <p>
        {{
          $t('common.phe-mismatch', {
            calculated: proteinPheReference(protein, foodType)
          })
        }}
      </p>
      <SecondaryButton
        :text="$t('common.recalculate')"
        class="mt-2 mr-0! mb-0!"
        @click="applyConversion(protein, foodType)"
      />
    </div>
  </template>

  <div v-else class="flex gap-4">
    <NumberInput
      v-model="phe"
      :id-name="`${idPrefix}phe`"
      :label="$t('common.phe-per-100g')"
      class="flex-1"
    />
    <NumberInput
      v-model="kcal"
      :id-name="`${idPrefix}kcal`"
      :label="$t('common.kcal-per-100g')"
      class="flex-1"
    />
  </div>
</template>
