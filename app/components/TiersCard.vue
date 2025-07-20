<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'

const { t } = useI18n()

const tiers = computed(() => [
  {
    name: t('settings.tier-basic'),
    id: 'tier-basic',
    price: '€0',
    description: t('settings.tier-basic-desc'),
    features: [
      t('settings.tier-basic-feature-1'),
      t('settings.tier-basic-feature-2'),
      t('settings.tier-basic-feature-3')
    ],
    featured: false
  },
  {
    name: t('settings.tier-unlimited'),
    id: 'tier-unlimited',
    price: '€2',
    description: t('settings.tier-unlimited-desc'),
    features: [
      t('settings.tier-unlimited-feature-1'),
      t('settings.tier-unlimited-feature-2'),
      t('settings.tier-unlimited-feature-3'),
      t('settings.tier-unlimited-feature-5'),
      t('settings.tier-unlimited-feature-6')
    ],
    featured: true
  },
  {
    name: t('settings.tier-lifetime'),
    id: 'tier-lifetime',
    price: '€49',
    description: t('settings.tier-lifetime-desc'),
    features: [
      t('settings.tier-unlimited-feature-1'),
      t('settings.tier-unlimited-feature-2'),
      t('settings.tier-unlimited-feature-3'),
      t('settings.tier-unlimited-feature-5'),
      t('settings.tier-unlimited-feature-6')
    ],
    featured: true
  }
])
</script>

<template>
  <div
    class="mx-auto my-6 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:gap-y-0 lg:max-w-5xl lg:grid-cols-3"
  >
    <div
      v-for="(tier, tierIdx) in tiers"
      :key="tier.id"
      :class="[
        tier.featured ? 'relative' : 'sm:mx-8 lg:mx-0',
        tierIdx <= 1
          ? 'rounded-t-xl sm:rounded-b-none lg:rounded-tr-none lg:rounded-bl-xl'
          : 'sm:rounded-t-none lg:rounded-tr-xl lg:rounded-bl-none',
        'rounded-xl p-8 ring-1 ring-gray-200 dark:ring-gray-800'
      ]"
    >
      <h3
        :id="tier.id"
        :class="[tier.featured ? '' : '', 'text-sky-500 text-base/7 font-semibold']"
      >
        {{ tier.name }}
      </h3>
      <p class="mt-4 flex items-baseline gap-x-1">
        <span :class="[tier.featured ? '' : '', 'text-xl font-semibold tracking-tight']">{{
          tier.price
        }}</span>
        <span v-if="tier.id === 'tier-unlimited'" class="text-gray-500 text-base">{{
          $t('settings.per-month')
        }}</span>
        <span v-if="tier.id === 'tier-lifetime'" class="text-gray-500 text-base">{{
          $t('settings.one-time')
        }}</span>
      </p>
      <p :class="[tier.featured ? '' : '', 'text-gray-500 mt-4 text-base/7']">
        {{ tier.description }}
      </p>
      <ul role="list" :class="[tier.featured ? '' : '', 'text-gray-500 mt-4 space-y-1 text-sm/6']">
        <li v-for="feature in tier.features" :key="feature" class="flex gap-x-2">
          <Check
            :class="[tier.featured ? '' : '', 'text-sky-500 h-6 w-5 flex-none']"
            aria-hidden="true"
          />
          {{ feature }}
        </li>
      </ul>
      <a
        href="https://buymeacoffee.com/andrereus/membership"
        target="_blank"
        class="bg-sky-500 text-white shadow-xs hover:bg-sky-400 focus-visible:outline-sky-500 mt-6 block rounded-md px-3.5 py-1 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        v-if="tier.id === 'tier-unlimited'"
        >{{ $t('settings.subscribe') }}</a
      >
      <a
        href="https://buymeacoffee.com/andrereus/membership"
        target="_blank"
        class="bg-black/5 dark:bg-white/15 text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-sky-500 mt-6 block rounded-md px-3.5 py-1 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        v-if="tier.id === 'tier-lifetime'"
        >{{ $t('settings.buy') }}</a
      >
    </div>
  </div>
</template>
