<script setup>
const { t } = useI18n()

const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')

definePageMeta({
  i18n: {
    paths: {
      en: '/imprint',
      de: '/impressum',
      es: '/aviso-legal',
      fr: '/mentions-legales'
    }
  }
})

useSeoMeta({
  title: () => t('imprint.title')
})

defineOgImage('Default', {
  title: () => t('imprint.title') + ' - PKU Tools'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('imprint.title')" />
    </header>

    <p>
      André Reus
      <br />
      Obere Gasse 38
      <br />
      71120 Grafenau
    </p>

    <!-- prettier-ignore -->
    <p>{{ $t("imprint.email") }}: {{ part1 }}@<span class="hidden">null</span>{{ part2 }}.{{ part3 }}</p>
    <br />
    <p>{{ $t('imprint.sources') }}:</p>
    <ul class="mt-2 list-disc pl-5 space-y-1">
      <li>
        USDA FoodData Central —
        <a
          href="https://fdc.nal.usda.gov"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 underline"
        >
          fdc.nal.usda.gov
        </a>
      </li>
      <li>{{ $t('imprint.source-bls') }} — Max Rubner-Institut</li>
      <li>
        Open Food Facts —
        <a
          href="https://openfoodfacts.org"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 underline"
        >
          openfoodfacts.org
        </a>
      </li>
    </ul>
    <br />
    <p>
      {{ $t('imprint.open-source') }}:
      <a
        href="https://github.com/andrereus/pkutools-3"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 underline"
      >
        GitHub
      </a>
    </p>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>
