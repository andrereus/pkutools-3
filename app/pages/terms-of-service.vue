<script setup>
const { t, locale } = useI18n()

definePageMeta({
  i18n: {
    paths: {
      en: '/terms-of-service',
      de: '/nutzungsbedingungen',
      es: '/condiciones-servicio',
      fr: '/conditions-utilisation'
    }
  }
})

useSeoMeta({
  title: () => t('terms.title')
})

defineOgImage('Default', {
  title: () => t('terms.title') + ' - PKU Tools'
})
</script>

<template>
  <div class="prose dark:prose-invert [&_h1]:hyphens-auto [&_h1]:wrap-break-word">
    <!-- The German heading is a single compound word ("Nutzungsbedingungen") with
         no space to break at, so it overflows a phone screen. Hyphenate it. -->
    <LegalTermsDe v-if="locale === 'de'" />
    <LegalTermsEs v-else-if="locale === 'es'" />
    <LegalTermsFr v-else-if="locale === 'fr'" />
    <LegalTermsEn v-else />
  </div>
</template>
