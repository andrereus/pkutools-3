<script setup>
const { t, locale } = useI18n()

definePageMeta({
  i18n: {
    paths: {
      en: '/privacy-policy',
      de: '/datenschutz',
      es: '/politica-privacidad',
      fr: '/politique-confidentialite'
    }
  }
})

useSeoMeta({
  title: () => t('privacy-policy.title')
})

defineOgImage('Default', {
  title: () => t('privacy-policy.title') + ' - PKU Tools'
})
</script>

<template>
  <div class="prose dark:prose-invert">
    <LegalPrivacyPolicyDe v-if="locale === 'de'" />
    <LegalPrivacyPolicyEs v-else-if="locale === 'es'" />
    <LegalPrivacyPolicyFr v-else-if="locale === 'fr'" />
    <LegalPrivacyPolicyEn v-else />
  </div>
</template>
