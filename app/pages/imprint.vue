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

defineOgImageComponent('NuxtSeo', {
  title: () => t('imprint.title') + ' - PKU Tools',
  theme: '#3498db'
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
    <p>{{ $t('imprint.sources') }}</p>
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
