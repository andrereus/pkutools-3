<script setup>
const { t } = useI18n()

const props = defineProps({
  align: {
    type: String,
    default: 'center',
    validator: (v) => ['center', 'left'].includes(v)
  }
})

const tiers = computed(() => [
  {
    name: t('settings.tier-basic'),
    id: 'tier-basic',
    price: '€0',
    description: t('settings.tier-basic-desc'),
    features: [
      t('settings.tier-basic-feature-1'),
      t('settings.tier-basic-feature-2'),
      t('settings.tier-basic-feature-3'),
      t('settings.tier-feature-try-ai')
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
      t('settings.tier-unlimited-feature-6'),
      t('settings.tier-feature-try-ai')
    ],
    featured: false
  },
  {
    name: t('settings.tier-premium-ai'),
    id: 'tier-premium-ai',
    price: '€5',
    description: t('settings.tier-premium-ai-desc'),
    features: [
      t('settings.tier-premium-ai-feature-all'),
      t('settings.tier-premium-ai-feature-ai')
    ],
    featured: true
  }
])
</script>

<template>
  <div
    :class="[
      props.align === 'center' ? 'mx-auto' : '',
      'my-6 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:gap-y-0 lg:max-w-5xl lg:grid-cols-3'
    ]"
  >
    <div
      v-for="(tier, tierIdx) in tiers"
      :key="tier.id"
      :class="[
        tier.featured ? 'relative' : 'sm:mx-8 lg:mx-0',
        tierIdx === 0
          ? 'rounded-t-xl sm:rounded-b-none lg:rounded-tr-none lg:rounded-bl-xl'
          : tierIdx === tiers.length - 1
            ? 'rounded-t-xl sm:rounded-b-none lg:rounded-tl-none lg:rounded-bl-none lg:rounded-tr-xl lg:rounded-br-xl'
            : '',
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
        <span
          v-if="tier.id === 'tier-unlimited' || tier.id === 'tier-premium-ai'"
          class="text-gray-500 text-base"
          >{{ $t('settings.per-month') }}</span
        >
      </p>
      <p :class="[tier.featured ? '' : '', 'text-gray-500 mt-4 text-base/7']">
        {{ tier.description }}
      </p>
      <ul role="list" :class="[tier.featured ? '' : '', 'text-gray-500 mt-4 space-y-1 text-sm/6']">
        <li v-for="feature in tier.features" :key="feature" class="flex gap-x-2">
          <LucideCheck
            :class="[tier.featured ? '' : '', 'text-sky-500 h-6 w-5 flex-none']"
            aria-hidden="true"
          />
          {{ feature }}
        </li>
      </ul>
      <a
        v-if="tier.id === 'tier-unlimited' || tier.id === 'tier-premium-ai'"
        href="https://ko-fi.com/andrereus/tiers"
        target="_blank"
        class="bg-sky-500 text-white shadow-xs hover:bg-sky-400 focus-visible:outline-sky-500 mt-6 block rounded-full px-3 py-1.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500"
        >{{ $t('settings.subscribe') }}</a
      >
    </div>
  </div>
</template>
