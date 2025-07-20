<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import { format, subDays } from 'date-fns'
import { Award, Activity, BicepsFlexed } from 'lucide-vue-next'

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

// Calculate recent activity
const recentActivity = computed(() => {
  const last14Days = getDiaryEntriesForDays(14, true)
  return {
    count: last14Days.length,
    total: 14,
    achieved: last14Days.length >= 10
  }
})

// Badges configuration
const badges = computed(() => [
  {
    id: 'streak',
    title: t('badges.streak-title'),
    description: t('badges.streak-description', { days: streak.value }),
    earned: streak.value >= 5,
    progress: Math.min(Math.round((streak.value / 5) * 100), 100)
  },
  {
    id: 'history',
    title: t('badges.history-title'),
    description: t('badges.history-description', {
      days: recentActivity.value.count,
      total: recentActivity.value.total
    }),
    earned: recentActivity.value.achieved,
    progress: Math.min(Math.round((recentActivity.value.count / 10) * 100), 100)
  }
])
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-sm">
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center gap-3 font-medium mb-2">
        <Award class="h-5 w-5" />
        {{ $t('assistant.motivation') }}
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <p v-if="streak > 0">
            {{ $t('assistant.streak', { streak }) }}
            {{ streak >= 7 ? $t('assistant.week') : $t('assistant.keep-going') }}
          </p>
          <p v-else>
            {{ $t('assistant.start-tracking') }}
          </p>
        </div>
        <!-- Streak Badge -->
        <div class="flex items-center gap-4">
          <div
            class="p-2 rounded-full"
            :class="
              badges[0].earned
                ? 'bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-300'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
            "
          >
            <Activity class="h-5 w-5" />
          </div>
          <div class="flex-1">
            <div class="flex justify-between items-center">
              <h4 class="text-sm font-medium">{{ badges[0].title }}</h4>
              <span class="text-xs text-gray-500">{{ badges[0].progress }}%</span>
            </div>
            <p class="text-sm text-gray-500">{{ badges[0].description }}</p>
            <div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                class="h-1.5 rounded-full"
                :class="badges[0].earned ? 'bg-sky-500' : 'bg-gray-400'"
                :style="{ width: `${badges[0].progress}%` }"
              ></div>
            </div>
          </div>
        </div>
        <!-- History Badge -->
        <div class="flex items-center gap-4">
          <div
            class="p-2 rounded-full"
            :class="
              badges[1].earned
                ? 'bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-300'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
            "
          >
            <BicepsFlexed class="h-5 w-5" />
          </div>
          <div class="flex-1">
            <div class="flex justify-between items-center">
              <h4 class="text-sm font-medium">{{ badges[1].title }}</h4>
              <span class="text-xs text-gray-500">{{ badges[1].progress }}%</span>
            </div>
            <p class="text-sm text-gray-500">{{ badges[1].description }}</p>
            <div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                class="h-1.5 rounded-full"
                :class="badges[1].earned ? 'bg-sky-500' : 'bg-gray-400'"
                :style="{ width: `${badges[1].progress}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
