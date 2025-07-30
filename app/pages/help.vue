<script setup>
const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('help.title')" />
    </header>

    <!-- prettier-ignore -->
    <p class="mb-8">{{ $t("help.contact-me") }} {{ part1 }}@<span class="hidden">null</span>{{ part2 }}.{{ part3 }}</p>

    <PageHeader :title="$t('help.install')" class="mt-6" />

    <p>{{ $t('help.install-p1') }}</p>
    <br />
    <p>
      <span class="font-bold">{{ $t('help.install-p2') }}</span>
      <a href="https://play.google.com/store/apps/details?id=com.pkutools.twa" target="_blank">
        <img
          alt="Get it on Google Play"
          src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
          class="gplay-btn"
        />
      </a>
      {{ $t('help.install-p2-2') }}
    </p>
    <img src="~/assets/images/install-pwa-android.png" alt="PWA on Android" class="pwa-img" />

    <p class="mb-2">
      <span class="font-bold">iOS:</span>
      {{ $t('help.install-p3') }}
    </p>
    <img src="~/assets/images/install-pwa-ios.png" alt="PWA on iOS" class="pwa-img" />

    <p class="mb-2">
      <span class="font-bold">PC:</span>
      {{ $t('help.install-p4') }}
    </p>
    <img src="~/assets/images/install-pwa-desktop.png" alt="PWA on desktop" class="pwa-img" />
  </div>
</template>

<style scoped>
.gplay-btn {
  display: inline-block;
  width: 125px;
  vertical-align: middle;
}

.hidden {
  display: none;
}

.pwa-img {
  width: 100%;
  max-width: 700px;
  height: auto;
  margin: 15px 0 30px;
}
</style>
