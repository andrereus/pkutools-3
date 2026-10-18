<script setup>
import { LucideSearch, LucideScanBarcode, LucideSparkles, LucideCalculator } from '@lucide/vue'

const route = useRoute()
const getRouteBaseName = useRouteBaseName()

// In the order of toolPages, which the page slides follow
const tools = [
  { route: 'food-search', label: 'app.search', icon: LucideSearch },
  { route: 'barcode-scanner', label: 'app.scanner', icon: LucideScanBarcode },
  { route: 'ai-calculator', label: 'app.ai-calculator', icon: LucideSparkles },
  { route: 'phe-calculator', label: 'app.calculator', icon: LucideCalculator }
]

const currentTool = computed(() => getRouteBaseName(route))
</script>

<!-- Its fixed height matches the space the default layout reserves for it -->
<template>
  <nav class="flex h-11 gap-3 justify-center" aria-label="Tabs">
    <NuxtLink
      v-for="tool in tools"
      :key="tool.route"
      :to="$localePath(tool.route)"
      :title="$t(tool.label)"
      :aria-current="currentTool === tool.route ? 'page' : undefined"
      class="rounded-xl p-3 dark:text-gray-300 inline-flex items-center gap-2 text-sm font-medium"
      :class="
        currentTool === tool.route
          ? 'bg-black/5 dark:bg-white/15 text-gray-700'
          : 'text-gray-500 hover:text-gray-700'
      "
    >
      <component :is="tool.icon" class="h-5 w-5" />
      <span class="hidden sm:inline">{{ $t(tool.label) }}</span>
    </NuxtLink>
  </nav>
</template>
