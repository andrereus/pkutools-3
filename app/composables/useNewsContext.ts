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
export const communityFoodAppearsInNews = (
  food: Food,
  locale: string,
  showHiddenFoods = false
): boolean =>
  food.language === locale &&
  isNewsTimestamp(food.createdAt) &&
  (showHiddenFoods || !isCommunityFoodHidden(communityFoodScore(food)))

/** Whether the toggle can reveal any food in this language, regardless of its current state. */
export const hasHiddenFoodsInNews = (foods: Food[], locale: string): boolean =>
  foods.some(
    (food) =>
      communityFoodAppearsInNews(food, locale, true) &&
      isCommunityFoodHidden(communityFoodScore(food))
  )

/** Something that happened to the reader, shown above the timeline. */
export interface Notice {
  key: string
  foodKey: string
  language: string
  name: string
  netDislikes: number
  isHidden: boolean
  hasNegativeFeedback: boolean
  /** Community feedback newer than the contributor's last reply or food edit. */
  pendingCommentAt?: number
}

/** Notices include their target language so foods remain reachable across locales. */
export const communityFoodNotices = (foods: Food[], currentUserId?: string | null): Notice[] => {
  if (!currentUserId) return []
  return foods.flatMap((food) => {
    const score = communityFoodScore(food)
    const foodKey = food['.key']
    const language = food.language
    const lastReply = isNewsTimestamp(food.lastContributorCommentAt)
      ? food.lastContributorCommentAt
      : 0
    const lastEdit = isNewsTimestamp(food.contentUpdatedAt) ? food.contentUpdatedAt : 0
    const pendingCommentAt =
      typeof food.commentCount === 'number' &&
      food.commentCount > 0 &&
      isNewsTimestamp(food.lastCommunityCommentAt) &&
      food.lastCommunityCommentAt > Math.max(lastReply, lastEdit)
        ? food.lastCommunityCommentAt
        : undefined
    const hasNegativeFeedback = score <= COMMUNITY_FOOD_FLAG_SCORE
    if (
      food.contributorId !== currentUserId ||
      (!hasNegativeFeedback && pendingCommentAt === undefined) ||
      typeof foodKey !== 'string' ||
      !foodKey ||
      typeof food.name !== 'string' ||
      typeof language !== 'string' ||
      !['en', 'de', 'es', 'fr'].includes(language) ||
      !isNewsTimestamp(food.createdAt)
    ) {
      return []
    }
    return [
      {
        key: `own-flag-${foodKey}`,
        foodKey,
        language,
        name: food.name,
        netDislikes: -score,
        isHidden: isCommunityFoodHidden(score),
        hasNegativeFeedback,
        ...(pendingCommentAt !== undefined && { pendingCommentAt })
      }
    ]
  })
}

export interface NewsEntry {
  key: string
  kind: 'note' | 'food-shared' | 'streak'
  createdAt: number
  /** Latest content edit, used for feed order, displayed dates and read state. */
  contentUpdatedAt?: number
  category?: string
  title?: string
  body?: string
  /** Monotonic publication order, present only on release notes. */
  revision?: number
  food?: Record<string, unknown>
  /** Shared by the current reader. */
  isOwn?: boolean
  /** Hidden from Food Search; News readers can opt in to review feedback. */
  isHidden?: boolean
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
  // Local to this consumer, not a saved setting. The header badge keeps the
  // default exclusion even when the News page opts in to hidden foods.
  const showHiddenFoods = ref(false)
  const hasHiddenFoods = computed(
    () => userIsAuthenticated.value && hasHiddenFoodsInNews(foods.value, locale.value)
  )

  const foodEntries = computed<NewsEntry[]>(() => {
    if (!userIsAuthenticated.value) return []
    return (
      foods.value
        // The same toggle applies to every food, including the reader's own.
        .filter((food) => communityFoodAppearsInNews(food, locale.value, showHiddenFoods.value))
        .map((food) => ({
          key: `food-${food['.key']}`,
          kind: 'food-shared' as const,
          // communityFoodAppearsInNews rejects an invalid timestamp before the
          // record can reach rendering or the maximum read-cursor calculation.
          createdAt: food.createdAt as number,
          ...(isNewsTimestamp(food.contentUpdatedAt) && {
            contentUpdatedAt: food.contentUpdatedAt
          }),
          food,
          isOwn: !!user.value?.id && food.contributorId === user.value.id,
          isHidden: isCommunityFoodHidden(communityFoodScore(food))
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

  // Pending feedback is independent of browser-local read state. Visiting News
  // clears its bell dot; replying or editing the food clears the comment notice.
  const notices = computed(() => communityFoodNotices(foods.value, user.value?.id))
  const commentEntries = computed(() =>
    notices.value.flatMap((notice) =>
      notice.pendingCommentAt === undefined
        ? []
        : [{ key: `comment-${notice.foodKey}`, createdAt: notice.pendingCommentAt }]
    )
  )

  return {
    store,
    locale,
    foodEntries,
    milestoneEntries,
    notices,
    commentEntries,
    showHiddenFoods,
    hasHiddenFoods,
    userIsAuthenticated
  }
}
