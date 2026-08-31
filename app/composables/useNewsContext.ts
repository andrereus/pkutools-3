import { useStore } from '../../stores/index'
import { format } from 'date-fns'
import {
  COMMUNITY_FOOD_FLAG_SCORE,
  communityFoodScore,
  isCommunityFoodHidden
} from '../utils/community-food'
import { streakMilestones } from '../utils/milestones'
import { isNewsTimestamp } from '../utils/news-grouping'

// The half of News that comes from the realtime store: community foods, diary
// streaks, and anything needing attention.
//
// It lives in its own module and imports no changelog, which is the point. The
// header draws an unread dot on every page and needs this half; splitting the
// functions apart inside one file would not have helped, because a static import
// pulls the whole module into whatever bundle reaches it. Keeping the changelog
// out of this file is what keeps it out of every page.

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
  /** Shared by the reader themselves, which changes how the entry reads. */
  isOwn?: boolean
  /** Only this reader sees it, which the entry has to say out loud. */
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
 * The half of the page that comes from the realtime store: community foods,
 * diary streaks, and anything needing attention.
 *
 * Shared by the page and by the header so the two can never disagree about what
 * counts as unread — and separate from the changelog so the header can be built
 * without it.
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
        // The rule food search already applies: a food voted out of search is
        // not handed back through news, and one published in another
        // language is not shown to someone who could not find it anyway.
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

  /**
   * The one thing that happens to a reader which they could not otherwise find
   * out: the community has questioned a food they shared. Somebody else acted,
   * and nothing else in the app goes looking for them to say so.
   *
   * Deliberately the only notice here. Two others were tried and removed. A
   * missing Phe target and an old blood value are both already visible where
   * they matter — in settings, in the diary, on the blood values page — and
   * repeating them turns a page about what is new into a list of chores.
   *
   * The blood value one failed a second test worth writing down: it needed the
   * app to decide how many weeks were too many. A statement of fact stops being
   * one as soon as the threshold behind it is the app's choice rather than the
   * reader's, and at that point it is advice about managing a condition, which
   * this app does not give.
   *
   * Derived, so it disappears the moment the votes recover or the values are
   * corrected, rather than lingering as a stored message.
   */
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
