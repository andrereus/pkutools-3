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
  <div class="prose dark:prose-invert">
    <LegalTermsDe v-if="locale === 'de'" />
    <LegalTermsEs v-else-if="locale === 'es'" />
    <LegalTermsFr v-else-if="locale === 'fr'" />
    <LegalTermsEn v-else />
  </div>
</template>
