<script setup>
const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')
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
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>
