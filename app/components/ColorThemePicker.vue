<script setup>
const { t } = useI18n()
const { accentPreference } = useAccentColor()
const options = computed(() => [
  { value: 'sky', label: t('settings.accent-sky'), shortLabel: t('settings.accent-sky-short') },
  {
    value: 'random',
    label: t('settings.accent-random'),
    shortLabel: t('settings.accent-random-short')
  },
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
    <div class="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
          :aria-label="option.label"
          class="peer sr-only"
        />
        <span
          class="flex h-full min-h-9 items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-sm text-gray-900 ring-1 ring-gray-300 peer-checked:ring-theme-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-theme-ink dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600 dark:peer-checked:ring-theme-ink sm:gap-2 sm:px-3"
        >
          <span class="h-3 w-3 shrink-0 rounded-full bg-sky-500 sm:h-4 sm:w-4" aria-hidden="true" />
          <span class="min-w-0 break-words sm:hidden">{{ option.shortLabel || option.label }}</span>
          <span class="hidden sm:inline">{{ option.label }}</span>
          <span
            class="ml-auto flex h-3 w-3 shrink-0 items-center justify-center sm:ml-0 sm:h-4 sm:w-4"
            aria-hidden="true"
          >
            <LucideCheck v-if="accentPreference === option.value" class="h-4 w-4 text-theme-ink" />
          </span>
        </span>
      </label>
    </div>
    <p
      v-if="accentPreference === 'random'"
      class="mt-2 text-xs text-gray-600 dark:text-gray-400 sm:hidden"
    >
      {{ $t('settings.accent-random') }}
    </p>
  </fieldset>
</template>
