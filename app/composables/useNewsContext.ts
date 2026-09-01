import { useStore } from '../../stores/index'
import { format } from 'date-fns'
import {
  COMMUNITY_FOOD_FLAG_SCORE,
  communityFoodScore,
  isCommunityFoodHidden
} from '../utils/community-food'
import { streakMilestones } from '../utils/milestones'
import { isNewsTimestamp } from '../utils/news-grouping'

// Realtime News sources shared by the page and global unread badge. This module
// intentionally has no changelog import, keeping that content page-scoped.

type Food = Record<string, unknown>

/** The exact visibility rule used by the runtime feed and its tests. */
export const communityFoodAppearsInNews = (food: Food, locale: string): boolean =>
  food.language === locale &&
  isNewsTimestamp(food.createdAt) &&
  !isCommunityFoodHidden(communityFoodScore(food))

/** Something that happened to the reader, shown above the timeline. */
export interface Notice {
  key: string
  kind: 'own-flag'
  route: string
  params?: Record<string, string | number>
}

export interface NewsEntry {
  key: string
  kind: 'note' | 'food-shared' | 'streak'
  createdAt: number
  category?: string
  title?: string
  body?: string
  /** Monotonic publication order, present only on release notes. */
  revision?: number
  food?: Record<string, unknown>
  /** Shared by the current reader. */
  isOwn?: boolean
  /** Visible only to the current reader. */
  private?: boolean
  count?: number
  /**
   * The calendar day, for entries that have one. Kept alongside `createdAt` so
   * the date can be formatted from the day itself rather than from a timestamp
   * that has to be read back in the timezone it was built in.
   */
  date?: string
}

/**
 * Builds News entries from realtime store data.
 */
export const useNewsContext = () => {
  const store = useStore()
  const { locale } = useI18n()

  // The store is plain JavaScript, so `user` is inferred from its null initial
  // value. Narrowed here rather than left to optional chaining, which types the
  // result as never.
  const user = computed(() => store.user as { id?: string } | null)
  const userIsAuthenticated = computed(() => user.value !== null)
  const foods = computed(() => store.communityFoods as Food[])

  const foodEntries = computed<NewsEntry[]>(() => {
    if (!userIsAuthenticated.value) return []
    return (
      foods.value
        // Match Food Search visibility and language rules.
        .filter((food) => communityFoodAppearsInNews(food, locale.value))
        .map((food) => ({
          key: `food-${food['.key']}`,
          kind: 'food-shared' as const,
          // communityFoodAppearsInNews rejects an invalid timestamp before the
          // record can reach rendering or the maximum read-cursor calculation.
          createdAt: food.createdAt as number,
          food,
          isOwn: !!user.value?.id && food.contributorId === user.value.id
        }))
    )
  })

  // Streak dates are calendar days. Re-evaluating at local midnight prevents a
  // mistakenly future-dated diary row from entering the feed early, without a
  // timer that runs more often than the rule can change.
  const today = ref(format(new Date(), 'yyyy-MM-dd'))
  let midnightTimer: ReturnType<typeof setTimeout> | undefined

  const scheduleMidnight = () => {
    const current = new Date()
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1)
    midnightTimer = setTimeout(
      () => {
        today.value = format(new Date(), 'yyyy-MM-dd')
        scheduleMidnight()
      },
      next.getTime() - current.getTime() + 100
    )
  }

  onMounted(scheduleMidnight)
  onUnmounted(() => clearTimeout(midnightTimer))

  const milestoneEntries = computed<NewsEntry[]>(() => {
    if (!userIsAuthenticated.value) return []

    const diaryDays = (store.pheDiary as { date?: string }[]).filter(
      (day) => !day.date || day.date <= today.value
    )

    return streakMilestones(diaryDays).map((milestone) => ({
      key: `streak-${milestone.count}-${milestone.date}`,
      kind: 'streak' as const,
      createdAt: milestone.createdAt,
      date: milestone.date,
      count: milestone.count,
      private: true
    }))
  })

  // Derived from the current score, so the notice clears when the score or food
  // changes rather than requiring separate persisted state.
  const notices = computed<Notice[]>(() => {
    const userId = user.value?.id
    if (!userIsAuthenticated.value || !userId) return []
    return foods.value
      .filter(
        (food) =>
          food.contributorId === userId && communityFoodScore(food) <= COMMUNITY_FOOD_FLAG_SCORE
      )
      .map((food) => ({
        key: `own-flag-${food['.key']}`,
        kind: 'own-flag' as const,
        route: 'own-food',
        params: { name: food.name as string }
      }))
  })

  return {
    store,
    locale,
    foodEntries,
    milestoneEntries,
    notices,
    userIsAuthenticated
  }
}
