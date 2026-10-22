import type { Ref } from 'vue'
import { useStore } from '../../stores/index'
import { format } from 'date-fns'
import {
  COMMUNITY_FOOD_FLAG_SCORE,
  communityFoodScore,
  isCommunityFoodHidden
} from '../utils/community-food'
import { streakMilestones } from '../utils/milestones'
import { isNewsTimestamp } from '../utils/news-grouping'
import { isVisibleTo } from '../utils/hidden-content'

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
/**
 * The reader's read state for foods or for posts, by key. `lastReadAt` is when
 * they last opened the comments or wrote one; a comment up to then has been
 * read.
 */
export type ThreadReadStates = Record<string, unknown>

const readAtOf = (threads: ThreadReadStates | undefined, key: unknown): number => {
  const entry = typeof key === 'string' ? threads?.[key] : undefined
  const value = (entry as { lastReadAt?: unknown } | null | undefined)?.lastReadAt
  return isNewsTimestamp(value) ? value : 0
}

export const communityFoodNotices = (
  foods: Food[],
  currentUserId?: string | null,
  reads?: ThreadReadStates
): Notice[] => {
  if (!currentUserId) return []
  return foods.flatMap((food) => {
    const score = communityFoodScore(food)
    const foodKey = food['.key']
    const language = food.language
    const lastReply = isNewsTimestamp(food.lastContributorCommentAt)
      ? food.lastContributorCommentAt
      : 0
    const lastEdit = isNewsTimestamp(food.contentUpdatedAt) ? food.contentUpdatedAt : 0
    // A reply, an edit or opening the comments all settle what came before.
    const pendingCommentAt =
      typeof food.commentCount === 'number' &&
      food.commentCount > 0 &&
      isNewsTimestamp(food.lastCommunityCommentAt) &&
      food.lastCommunityCommentAt > Math.max(lastReply, lastEdit, readAtOf(reads, foodKey))
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

type Post = Record<string, unknown>

/** The visibility rule for posts in the feed, like the one for foods. */
export const communityPostAppearsInNews = (post: Post, locale: string): boolean =>
  post.language === locale &&
  isNewsTimestamp(post.createdAt) &&
  typeof post.text === 'string' &&
  post.text.trim() !== ''

/** Comments by others on the reader's own post, newer than the author's last reply or read. */
export interface PostNotice {
  key: string
  postKey: string
  language: string
  /** The start of the post, to recognise it by. */
  name: string
  pendingCommentAt: number
}

const POST_NOTICE_NAME_LENGTH = 60

/** The start of a post's first line, to recognise it by in a notice. */
const postExcerpt = (text: string): string => {
  const firstLine = text.trim().split('\n')[0]!
  return firstLine.length > POST_NOTICE_NAME_LENGTH
    ? `${firstLine.slice(0, POST_NOTICE_NAME_LENGTH).trimEnd()}…`
    : firstLine
}

export const communityPostNotices = (
  posts: Post[],
  currentUserId?: string | null,
  reads?: ThreadReadStates
): PostNotice[] => {
  if (!currentUserId) return []
  return posts.flatMap((post) => {
    const postKey = post['.key']
    const language = post.language
    const lastReply = Math.max(
      isNewsTimestamp(post.lastAuthorCommentAt) ? post.lastAuthorCommentAt : 0,
      readAtOf(reads, postKey)
    )
    if (
      post.authorId !== currentUserId ||
      typeof postKey !== 'string' ||
      !postKey ||
      typeof post.text !== 'string' ||
      typeof language !== 'string' ||
      !['en', 'de', 'es', 'fr'].includes(language) ||
      !isNewsTimestamp(post.createdAt) ||
      typeof post.commentCount !== 'number' ||
      post.commentCount <= 0 ||
      !isNewsTimestamp(post.lastCommunityCommentAt) ||
      post.lastCommunityCommentAt <= lastReply
    ) {
      return []
    }
    return [
      {
        key: `own-post-${postKey}`,
        postKey,
        language,
        name: postExcerpt(post.text),
        pendingCommentAt: post.lastCommunityCommentAt
      }
    ]
  })
}

/** A new comment in a conversation on someone else's food or post the reader joined. */
export interface ThreadNotice {
  key: string
  foodKey?: string
  postKey?: string
  language: string
  name: string
  pendingCommentAt: number
}

/**
 * Notices for others' foods and posts the reader commented on: their read
 * state there exists while they have a comment there.
 */
export const communityThreadNotices = (
  foods: Food[],
  posts: Post[],
  currentUserId?: string | null,
  threads?: { foods?: ThreadReadStates; posts?: ThreadReadStates }
): ThreadNotice[] => {
  if (!currentUserId) return []
  const sources = [
    { target: 'food', records: foods, threads: threads?.foods },
    { target: 'post', records: posts, threads: threads?.posts }
  ] as const
  return sources.flatMap(({ target, records, threads: threadsOfTarget }) =>
    records.flatMap((record) => {
      const key = record['.key']
      const language = record.language
      const name = target === 'food' ? record.name : record.text
      if (
        typeof key !== 'string' ||
        !key ||
        !threadsOfTarget ||
        !(key in threadsOfTarget) ||
        (target === 'food' ? record.contributorId : record.authorId) === currentUserId ||
        typeof name !== 'string' ||
        typeof language !== 'string' ||
        !['en', 'de', 'es', 'fr'].includes(language) ||
        !isNewsTimestamp(record.createdAt)
      ) {
        return []
      }
      // The newest comment by anyone. The reader's last read, by opening the
      // thread or commenting there, settles everything up to then.
      const ownerLast =
        target === 'food' ? record.lastContributorCommentAt : record.lastAuthorCommentAt
      const latest = Math.max(
        isNewsTimestamp(record.lastCommunityCommentAt) ? record.lastCommunityCommentAt : 0,
        isNewsTimestamp(ownerLast) ? ownerLast : 0
      )
      const settled = readAtOf(threadsOfTarget, key)
      if (latest <= settled) return []
      return [
        {
          key: `thread-${target}-${key}`,
          ...(target === 'food' ? { foodKey: key } : { postKey: key }),
          language,
          name: target === 'food' ? name : postExcerpt(name),
          pendingCommentAt: latest
        }
      ]
    })
  )
}

export interface NewsEntry {
  key: string
  kind: 'note' | 'food-shared' | 'post' | 'streak'
  createdAt: number
  /** Latest content edit, used for feed order, displayed dates and read state. */
  contentUpdatedAt?: number
  category?: string
  title?: string
  body?: string
  /** Monotonic publication order, present only on release notes. */
  revision?: number
  food?: Record<string, unknown>
  post?: Record<string, unknown>
  /** Shared or written by the current reader. */
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
export const useNewsContext = (options: { extraPosts?: Ref<Post[]> } = {}) => {
  const store = useStore()
  const { locale } = useI18n()

  // The feed follows the reader's app language. Every consumer asks for the
  // same, so this is a no-op after the first.
  watch(locale, (language) => store.setFeedQuery(language), { immediate: true })

  // The store is plain JavaScript, so `user` is inferred from its null initial
  // value. Narrowed here rather than left to optional chaining, which types the
  // result as never.
  const user = computed(() => store.user as { id?: string } | null)
  const userIsAuthenticated = computed(() => user.value !== null)
  // Hidden content reaches only its owner, here and in everything built from
  // these lists: the feed, notifications and the diary. Admins see here what
  // everyone sees, and hidden content on the admin page.
  const reader = computed(() => ({ id: user.value?.id ?? null, isAdmin: false }))
  const foods = computed(() =>
    (store.communityFoods as Food[]).filter((food) =>
      isVisibleTo(food, food.contributorId, reader.value)
    )
  )
  // The feed's newest posts, plus the followed ones whatever their age, so a
  // notification or a link always has its post, plus any the consumer loads
  // itself, such as one diary day's.
  const posts = computed(() => {
    const byKey = new Map<unknown, Post>()
    for (const post of [
      ...(store.communityPosts as Post[]),
      ...Object.values(store.followedCommunityPosts as Record<string, Post>),
      ...(options.extraPosts?.value ?? [])
    ]) {
      byKey.set(post['.key'], post)
    }
    return [...byKey.values()].filter((post) => isVisibleTo(post, post.authorId, reader.value))
  })
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

  const postEntries = computed<NewsEntry[]>(() => {
    if (!userIsAuthenticated.value) return []
    return posts.value
      .filter((post) => communityPostAppearsInNews(post, locale.value))
      .map((post) => ({
        key: `post-${post['.key']}`,
        kind: 'post' as const,
        createdAt: post.createdAt as number,
        post,
        isOwn: !!user.value?.id && post.authorId === user.value.id
      }))
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
  // clears its bell dot; opening the comments, replying or editing the food
  // clears the comment notice, on every device.
  const threads = computed(
    () => store.readState as { foods: ThreadReadStates; posts: ThreadReadStates }
  )
  const notices = computed(() =>
    communityFoodNotices(foods.value, user.value?.id, threads.value?.foods)
  )
  const postNotices = computed(() =>
    communityPostNotices(posts.value, user.value?.id, threads.value?.posts)
  )
  const threadNotices = computed(() =>
    communityThreadNotices(foods.value, posts.value, user.value?.id, threads.value)
  )
  const commentEntries = computed(() => [
    ...notices.value.flatMap((notice) =>
      notice.pendingCommentAt === undefined
        ? []
        : [{ key: `comment-${notice.foodKey}`, createdAt: notice.pendingCommentAt }]
    ),
    ...postNotices.value.map((notice) => ({
      key: `comment-post-${notice.postKey}`,
      createdAt: notice.pendingCommentAt
    })),
    ...threadNotices.value.map((notice) => ({
      key: `comment-${notice.key}`,
      createdAt: notice.pendingCommentAt
    }))
  ])

  return {
    store,
    locale,
    foodEntries,
    postEntries,
    milestoneEntries,
    notices,
    postNotices,
    threadNotices,
    commentEntries,
    showHiddenFoods,
    hasHiddenFoods,
    userIsAuthenticated
  }
}
