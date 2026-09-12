<script setup>
const { t } = useI18n()
const { accentPreference } = useAccentColor()
const options = computed(() => [
  { value: 'sky', label: t('settings.accent-sky') },
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
        :data-accent="option.value"
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
          class="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-900 ring-1 ring-gray-300 peer-checked:ring-2 peer-checked:ring-theme-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-theme-ink dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600 dark:peer-checked:ring-theme-ink"
        >
          <span class="h-4 w-4 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
          <span>{{ option.label }}</span>
          <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
            <LucideCheck v-if="accentPreference === option.value" class="h-4 w-4 text-theme-ink" />
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
