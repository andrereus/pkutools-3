<script setup>
const { t } = useI18n()

// Install and contact come first (the app's "install" button links here, and
// contact matters most for support). They open custom panels via named slots
// below; the remaining items render their translated answer text. Install
// also has a plain-text answer (a-install) used only for the structured data.
const faqItems = [
  { id: 'install', q: 'help.faq.q-install', slot: 'install', a: 'help.faq.a-install' },
  { q: 'help.faq.q-contact', slot: 'contact' },
  ...Array.from({ length: 18 }, (_, i) => ({
    q: `help.faq.q${i + 1}`,
    a: `help.faq.a${i + 1}`
  }))
]

// FAQPage structured data for search engines (rich results). Items without a
// text answer stay out — contact deliberately has none because of the email
useSchemaOrg([
  defineWebPage({ '@type': ['WebPage', 'FAQPage'] }),
  ...faqItems
    .filter((item) => item.a)
    .map((item) =>
      defineQuestion({
        name: () => t(item.q),
        acceptedAnswer: () => t(item.a)
      })
    )
])

definePageMeta({
  i18n: {
    paths: {
      en: '/help',
      de: '/hilfe',
      es: '/ayuda',
      fr: '/aide'
    }
  }
})

useSeoMeta({
  title: () => t('help.title')
})

defineOgImage('Default', {
  title: () => t('help.title') + ' - PKU Tools'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('help.title')" />
    </header>

    <div class="max-w-3xl">
      <FaqAccordion :items="faqItems">
        <template #contact>
          <p class="text-base leading-7 text-gray-600 dark:text-gray-400">
            {{ $t('help.contact-me') }} <LegalContactEmail />
          </p>
        </template>

        <template #install>
          <div class="text-base leading-7 text-gray-600 dark:text-gray-400">
            <p>{{ $t('help.install-p1') }}</p>

            <p class="mt-4">
              <span class="font-bold">{{ $t('help.install-p2') }}</span>
              {{ $t('help.install-p2-2') }}
            </p>
            <img
              src="~/assets/images/install-pwa-android.png"
              alt="PWA on Android"
              class="pwa-img"
            />

            <p class="mt-2">
              <span class="font-bold">iOS:</span>
              {{ $t('help.install-p3') }}
            </p>
            <img src="~/assets/images/install-pwa-ios.png" alt="PWA on iOS" class="pwa-img" />

            <p class="mt-2">
              <span class="font-bold">{{ $t('help.install-desktop') }}</span>
              {{ $t('help.install-p4') }}
            </p>
            <img
              src="~/assets/images/install-pwa-desktop.png"
              alt="PWA on desktop"
              class="pwa-img"
            />
          </div>
        </template>
      </FaqAccordion>
    </div>
  </div>
</template>

<style scoped>
.pwa-img {
  width: 100%;
  max-width: 700px;
  height: auto;
  margin: 15px 0 30px;
}
</style>
