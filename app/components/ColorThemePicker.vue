<script setup>
const { t } = useI18n()
const { accentPreference, accentColor } = useAccentColor()
const options = computed(() => [
  { value: 'sky', label: t('settings.accent-sky'), shortLabel: t('settings.accent-sky-short') },
  { value: 'random', label: t('settings.accent-random') },
  { value: 'blue', label: t('settings.accent-blue') },
  { value: 'violet', label: t('settings.accent-violet') },
  { value: 'teal', label: t('settings.accent-teal') },
  { value: 'orange', label: t('settings.accent-orange') },
  { value: 'red', label: t('settings.accent-red') }
])
</script>

<template>
  <fieldset>
    <legend class="text-sm font-medium leading-6 text-gray-900 dark:text-gray-300">
      {{ $t('settings.color-theme') }}
    </legend>
    <div class="mt-2 flex flex-wrap gap-2">
      <label
        v-for="option in options"
        :key="option.value"
        :data-accent="option.value === 'random' ? accentColor : option.value"
        class="min-w-0 cursor-pointer"
      >
        <input
          v-model="accentPreference"
          type="radio"
          name="color-theme"
          :value="option.value"
          class="peer sr-only"
        />
        <span
          class="flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm leading-6 text-gray-900 ring-1 ring-inset ring-gray-300 peer-checked:ring-2 peer-checked:ring-sky-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-sky-500 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:peer-checked:ring-sky-500"
        >
          <span class="h-4 w-4 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
          <span class="min-w-0 break-words">{{ option.shortLabel || option.label }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
