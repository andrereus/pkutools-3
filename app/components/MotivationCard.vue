<script setup>
import { useStore } from '../../stores/index'
import { format, subDays } from 'date-fns'
import {
  LucideAward,
  LucideFlame,
  LucideStar,
  LucideTrophy,
  LucideCrown
} from 'lucide-vue-next'

const store = useStore()
const { t } = useI18n()

const pheDiary = computed(() => store.pheDiary)

// Helper to get diary entries for date range
const getDiaryEntriesForDays = (days, includeToday = false) => {
  return [...Array(days)]
    .map((_, i) => {
      const date = format(subDays(new Date(), includeToday ? i : i + 1), 'yyyy-MM-dd')
      return pheDiary.value.find((entry) => entry.date === date)
    })
    .filter(Boolean)
}

// Calculate streak
const streak = computed(() => {
  if (!pheDiary.value.length) return 0
  let currentStreak = 0
  let currentDate = new Date()

  const todayStr = format(currentDate, 'yyyy-MM-dd')
  const todayEntry = pheDiary.value.find((e) => e.date === todayStr)
  if (todayEntry) currentStreak++

  while (true) {
    currentDate = subDays(currentDate, 1)
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    const entry = pheDiary.value.find((e) => e.date === dateStr)
    if (!entry) break
    currentStreak++
  }
  return currentStreak
})

// Badges configuration
const badges = computed(() => [
  {
    id: 'streak-3',
    title: t('badges.streak-3-title'),
    description: t('badges.streak-3-description'),
    earned: streak.value >= 3,
    icon: LucideFlame,
    earnedColor: 'text-orange-600 dark:text-orange-400',
    earnedBg: 'bg-orange-100 dark:bg-orange-900/30',
    earnedBorder: 'border-orange-300 dark:border-orange-800'
  },
  {
    id: 'streak-5',
    title: t('badges.streak-5-title'),
    description: t('badges.streak-5-description'),
    earned: streak.value >= 5,
    icon: LucideStar,
    earnedColor: 'text-yellow-600 dark:text-yellow-400',
    earnedBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    earnedBorder: 'border-yellow-300 dark:border-yellow-800'
  },
  {
    id: 'streak-7',
    title: t('badges.streak-7-title'),
    description: t('badges.streak-7-description'),
    earned: streak.value >= 7,
    icon: LucideAward,
    earnedColor: 'text-blue-600 dark:text-blue-400',
    earnedBg: 'bg-blue-100 dark:bg-blue-900/30',
    earnedBorder: 'border-blue-300 dark:border-blue-800'
  },
  {
    id: 'streak-14',
    title: t('badges.streak-14-title'),
    description: t('badges.streak-14-description'),
    earned: streak.value >= 14,
    icon: LucideCrown,
    earnedColor: 'text-purple-600 dark:text-purple-400',
    earnedBg: 'bg-purple-100 dark:bg-purple-900/30',
    earnedBorder: 'border-purple-300 dark:border-purple-800'
  }
])
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-sm">
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center gap-3 font-medium mb-2">
        <LucideAward class="h-5 w-5" />
        {{ $t('insights.motivation') }}
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <p v-if="streak > 0">
            {{ $t('insights.streak', { streak }) }}
          </p>
          <p v-else>
            {{ $t('insights.start-tracking') }}
          </p>
        </div>
        <!-- Badges -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="badge in badges"
            :key="badge.id"
            class="flex items-center gap-3 p-3 rounded-lg transition-all duration-200"
            :class="
              badge.earned
                ? `${badge.earnedBg} border-2 ${badge.earnedBorder} shadow-sm`
                : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-60'
            "
          >
            <div
              class="p-2.5 rounded-full flex-shrink-0 transition-all duration-200"
              :class="
                badge.earned
                  ? `${badge.earnedBg} ${badge.earnedColor} scale-110`
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
              "
            >
              <component :is="badge.icon" class="h-5 w-5" />
            </div>
            <div class="flex-1 min-w-0">
              <h4
                class="text-sm font-semibold transition-colors"
                :class="badge.earned ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'"
              >
                {{ badge.title }}
              </h4>
              <p
                class="text-xs mt-0.5 transition-colors"
                :class="badge.earned ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'"
              >
                {{ badge.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
