<script setup>
const { t } = useI18n()

const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')

// Install and contact come first (the app's "install" button links here, and
// contact matters most for support). They open custom panels via named slots
// below; the remaining items render their translated answer text. Install
// also has a plain-text answer (a-install) used only for the structured data.
const faqItems = [
  { q: 'help.faq.q-install', slot: 'install', a: 'help.faq.a-install' },
  { q: 'help.faq.q-contact', slot: 'contact' },
  ...Array.from({ length: 17 }, (_, i) => ({
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

defineOgImage('NuxtSeo', {
  title: () => t('help.title') + ' - PKU Tools',
  theme: '#0ea5e9'
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
          <!-- prettier-ignore -->
          <p class="text-base leading-7 text-gray-600 dark:text-gray-400">{{ $t("help.contact-me") }} {{ part1 }}@<span class="email-hidden">null</span>{{ part2 }}.{{ part3 }}</p>
        </template>

        <template #install>
          <div class="text-base leading-7 text-gray-600 dark:text-gray-400">
            <p>{{ $t('help.install-p1') }}</p>

            <p class="mt-4">
              <span class="font-bold">{{ $t('help.install-p2') }}</span>
              <a
                href="https://play.google.com/store/apps/details?id=com.pkutools.twa"
                target="_blank"
              >
                <img
                  alt="Get it on Google Play"
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  class="gplay-btn"
                />
              </a>
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
              <span class="font-bold">PC:</span>
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
.gplay-btn {
  display: inline-block;
  width: 125px;
  vertical-align: middle;
}

.email-hidden {
  display: none;
}

.pwa-img {
  width: 100%;
  max-width: 700px;
  height: auto;
  margin: 15px 0 30px;
}
</style>
