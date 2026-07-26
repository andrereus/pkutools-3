<script setup lang="ts">
// Rendered by nuxt-og-image (takumi renderer — chosen by the .takumi filename
// suffix). Community templates like NuxtSeo can only be used in dev since
// nuxt-og-image v6, so the social card lives here.
const { title = 'PKU Tools', description = '' } = defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center relative bg-white text-gray-900 px-[80px]">
    <div
      class="absolute top-0 left-0 right-0 bottom-0"
      style="
        background-image: radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.16), transparent 60%);
      "
    />
    <div
      class="absolute top-0 left-0 right-0 h-[16px]"
      style="background-image: linear-gradient(90deg, #38bdf8, #0284c7)"
    />

    <div class="relative flex flex-col">
      <img src="/pwa-192x192.png" width="104" height="104" alt="" />
      <h1
        class="text-[68px] font-bold leading-tight mt-[40px] mb-0 max-w-[940px]"
        style="text-wrap: balance"
      >
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="text-[34px] leading-snug text-gray-500 mt-[20px] mb-0 max-w-[900px]"
      >
        {{ description }}
      </p>
    </div>

    <!-- Only Inter 400 and 700 are bundled for OG rendering — stick to those weights. -->
    <div class="absolute bottom-[56px] left-[80px] text-[28px] font-bold text-sky-600">
      pkutools.com
    </div>
  </div>
</template>
