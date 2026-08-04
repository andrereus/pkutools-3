<script setup>
// The "also save to Own Food" option, shared by every tool that can produce a
// food worth keeping: the Phe calculator, the barcode scanner and both AI
// modes. One block rather than four copies, because the three parts below only
// make sense together — the note and the sharing checkbox belong to the own
// food, not to the diary entry the tool writes anyway.

defineProps({
  // Sharing is offered only where the values are the user's own calculation.
  // An AI estimate is a guess, so it stays out of the community database (see
  // SHAREABLE_FOOD_SOURCES).
  canShare: { type: Boolean, default: true },
  // Shown wherever the stored Phe was converted from protein and the user
  // picked the setting behind that conversion. Getting it wrong is worth
  // catching here: an own food keeps the value permanently, not just for one
  // meal. The sentence comes from the page because each names its own control —
  // "Type of food" in the scanners, "Input mode" in the Phe calculator — and
  // interpolating that name would put a German article in front of the wrong
  // gender.
  hint: { type: String, default: null }
})

const model = defineModel()
const note = defineModel('note')
const shared = defineModel('shared')

// Community sharing rides on the own-food entry, so it can't stay checked alone
watch(model, (value) => {
  if (!value) shared.value = false
})
</script>

<template>
  <div class="mb-6">
    <div class="flex items-start">
      <div class="flex h-6 items-center">
        <input
          id="save-own-food"
          v-model="model"
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

    <p v-if="model && hint" class="mt-3 text-sm text-amber-600 dark:text-amber-400">
      {{ hint }}
    </p>

    <div v-if="model" class="mt-3">
      <label
        for="own-food-note"
        class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-300"
        >{{ $t('diary.note') }}</label
      >
      <div class="mt-1">
        <textarea
          id="own-food-note"
          v-model="note"
          v-auto-grow
          name="own-food-note"
          rows="1"
          :placeholder="$t('diary.note-placeholder')"
          class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        />
      </div>
    </div>

    <div v-if="model && canShare" class="mt-3 flex items-start">
      <div class="flex h-6 items-center">
        <input
          id="share-community"
          v-model="shared"
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

    <p v-if="model && !canShare" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
      {{ $t('community.notShareable') }}
    </p>
  </div>
</template>
