<script setup>
import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from 'date-fns'
import { enUS, de, es, fr } from 'date-fns/locale'
import { FEED_POSTS_PAGE, useStore } from '../../stores/index'
import {
  emptySeen,
  filterNewsItems,
  hasEnoughCommunityItemsForFilter,
  isUnread,
  newsCountToReveal,
  newsEntryTimestamp,
  NEWS_PAGE_SIZE,
  seenAfterVisit,
  utcDayForLocalFormatting,
  visibleNewsItems
} from '../utils/news-grouping'
import { isHiddenByAdmin } from '../utils/hidden-content'

// Combines the authored changelog with entries derived from existing store data.

const store = useStore()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { voteCommunityFood } = useApi()
const { authorLabel, isOfficial } = useCommunityAuthor()
const {
  items,
  notices,
  postNotices,
  threadNotices,
  commentEntries,
  showHiddenFoods,
  hasHiddenFoods,
  userIsAuthenticated
} = useNews()
const seenState = useNewsSeen()

const userId = computed(() => store.user?.id ?? null)
const votingKey = ref(null)
const expandedComments = ref({})

// Keep the notice preview compact. Expanding lasts only for this page visit.
const NOTICE_PREVIEW_COUNT = 2
const showAllNotices = ref(false)
// Notices about the reader's own foods and posts, and about conversations they
// joined, all last until the comments have been opened.
const allNotices = computed(() => [...notices.value, ...postNotices.value, ...threadNotices.value])
const sortedNotices = computed(() =>
  [...allNotices.value].sort(
    (left, right) => (right.pendingCommentAt ?? 0) - (left.pendingCommentAt ?? 0)
  )
)
const visibleNotices = computed(() =>
  showAllNotices.value ? sortedNotices.value : sortedNotices.value.slice(0, NOTICE_PREVIEW_COUNT)
)
const additionalNoticeCount = computed(() =>
  Math.max(0, allNotices.value.length - NOTICE_PREVIEW_COUNT)
)
const noticeTarget = (notice) =>
  notice.postKey ? `post-${notice.postKey}` : `food-${notice.foodKey}`
// A food that collects dislikes or is hidden needs checking; a new comment
// does not, so only the first is amber.
const isWarningNotice = (notice) =>
  !notice.postKey && (notice.hasNegativeFeedback || notice.isHidden)
// The blue dot means new since the last visit, for notices as for cards. A
// rating warning is a standing state with no moment to be new, so amber is
// its only mark.
const isNoticeUnread = (notice) =>
  !!notice.pendingCommentAt && isItemUnread({ key: notice.key, createdAt: notice.pendingCommentAt })

// The API also rejects votes on the contributor's own food.
const canVote = (item) => userIsAuthenticated.value && !!item.food && !item.isOwn
const voteFor = (item) => (userId.value ? (item.food?.voterIds?.[userId.value] ?? null) : null)

// Authenticated feeds paginate; the public changelog remains complete for SSR.
const PAGE_SIZE = NEWS_PAGE_SIZE
const visibleCount = ref(PAGE_SIZE)
const selectedFilter = ref('all')

const filterDefinitions = [
  { key: 'all', label: 'news.filter-all' },
  { key: 'note', label: 'news.filter-app' },
  { key: 'community', label: 'news.filter-community' },
  { key: 'streak', label: 'news.filter-personal' }
]

const showFilters = computed(() => userIsAuthenticated.value)
// Community remains in All at low volume but gets its own filter once useful.
const showCommunityFilter = computed(() => hasEnoughCommunityItemsForFilter(items.value))
const availableFilters = computed(() =>
  filterDefinitions.filter(
    (filter) =>
      filter.key === 'all' ||
      (filter.key === 'community'
        ? showCommunityFilter.value
        : filterNewsItems(items.value, filter.key).length > 0)
  )
)
const filteredItems = computed(() =>
  filterNewsItems(items.value, showFilters.value ? selectedFilter.value : 'all')
)

watch(showFilters, (shown) => {
  if (!shown) {
    selectedFilter.value = 'all'
    showHiddenFoods.value = false
  }
})
watch(availableFilters, (filters) => {
  if (!filters.some((filter) => filter.key === selectedFilter.value)) {
    selectedFilter.value = 'all'
  }
})
watch([selectedFilter, showHiddenFoods], () => {
  visibleCount.value = PAGE_SIZE
})

// What had been seen when this page opened. Frozen once, so unread labels stay
// visible while the reader is on the page even after both markers advance.
const seen = ref(emptySeen())

// Until browser-local state has loaded, the server-rendered list has no unread
// decoration. This avoids a hydration mismatch and works with or without an
// account.
const canBeUnread = computed(() => seenState.ready.value)
const isItemUnread = (item) => canBeUnread.value && isUnread(item, seen.value)

// The read snapshot remains frozen for this visit, so an older item revealed by
// Load more still carries its original unread label. Opening News counts as the
// visit for the stored cursor, but no unread state forces all cards to mount.
const visibleItems = computed(() =>
  visibleNewsItems(filteredItems.value, visibleCount.value, userIsAuthenticated.value)
)
// A linked card beyond the shown part of the feed is shown first, on its own,
// rather than loading everything newer to reach its place.
// A line beneath it sets it apart from the feed's history.
const pinnedKey = ref(null)
const pinnedItem = computed(() => {
  const key = pinnedKey.value
  if (!key || visibleItems.value.some((item) => item.key === key)) return null
  return filteredItems.value.find((item) => item.key === key) ?? null
})
const shownItems = computed(() =>
  pinnedItem.value ? [pinnedItem.value, ...visibleItems.value] : visibleItems.value
)
// Posts load from the database as far as the feed is shown: a post among the
// first N items is always among the newest N posts in this language. A full
// window may have more beyond it.
watch(visibleCount, (count) => store.setFeedQuery(locale.value, Math.max(count, FEED_POSTS_PAGE)), {
  immediate: true
})
onUnmounted(() => store.setFeedQuery(locale.value, FEED_POSTS_PAGE))
// Only the filters that show posts can have more of them to load.
const morePosts = computed(() => {
  const filter = showFilters.value ? selectedFilter.value : 'all'
  return (
    (filter === 'all' || filter === 'community') &&
    store.feedLoaded &&
    store.communityPosts.length >= store.feedQuery.limit
  )
})
const hasMore = computed(
  () =>
    userIsAuthenticated.value &&
    (visibleItems.value.length < filteredItems.value.length || morePosts.value)
)
const loadMore = () => {
  visibleCount.value += PAGE_SIZE
}

const foodNoticeFor = (key) =>
  notices.value.find(
    (notice) => `food-${notice.foodKey}` === key && notice.language === locale.value
  )

// Any card can be linked to, from a notice or from the diary. Foods and posts
// open with their comments.
const revealCard = async (key) => {
  // A contributor notice remains accessible with the toggle off. Following
  // its link reveals the food and makes the toggle reflect that choice.
  if (foodNoticeFor(key)?.isHidden) showHiddenFoods.value = true
  if (!items.value.some((item) => item.key === key)) return
  selectedFilter.value = 'all'
  // Let the filter's pagination reset finish before placing the card.
  await nextTick()
  pendingReveal.value = key
}

// A signed-in reader's feed catches up first, so the card's place is known.
// Within the shown part it opens in place; beyond it, it is shown first.
const pendingReveal = ref(null)
watch([pendingReveal, filteredItems, () => store.feedLoaded], async () => {
  const key = pendingReveal.value
  if (!key || (userIsAuthenticated.value && !store.feedLoaded)) return
  const count = newsCountToReveal(filteredItems.value, visibleCount.value, key)
  if (count === null) return
  pendingReveal.value = null
  pinnedKey.value = count > visibleCount.value ? key : null
  const target = filteredItems.value.find((item) => item.key === key)
  if (target?.food || target?.post) expandedComments.value[key] = true
  await nextTick()
  const card = document.getElementById(key)
  card?.focus({ preventScroll: true })
  card?.scrollIntoView({ block: 'start' })
})

const viewNotice = (event, notice) => {
  // A repeated click on the current link must reopen comments too. Other
  // clicks follow the localized link and are handled by the hash watcher.
  if (
    notice.language !== locale.value ||
    route.hash !== `#${noticeTarget(notice)}` ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  event.preventDefault()
  void revealCard(noticeTarget(notice))
}

onMounted(() => {
  let revealedHash = null
  watch(
    () => route.hash,
    () => {
      revealedHash = null
    }
  )
  // A localized link can arrive before authentication/data restoration. Wait
  // for its card, then reveal it once; later votes must not steal focus again.
  watch(
    [() => route.hash, items, notices],
    ([hash]) => {
      if (!hash || hash === revealedHash) return
      const key = hash.slice(1)
      if (!items.value.some((item) => item.key === key) && !foodNoticeFor(key)) {
        // A post older than the loaded ones is followed, then shown when it arrives.
        if (key.startsWith('post-')) store.followLinkedPost(key.slice('post-'.length))
        return
      }
      revealedHash = hash
      void revealCard(key)
    },
    { immediate: true }
  )
})

const titleFor = (item) => {
  if (item.kind === 'note') return item.title
  if (item.kind === 'streak') return t('news.streak-title', { days: item.count })
  if (item.kind === 'post') {
    return authorLabel(item.post.authorId, userId.value)
  }
  return item.food.name
}
const bodyFor = (item) => {
  if (item.kind === 'note') return item.body
  if (item.kind === 'streak') return t('news.streak-text')
  return null
}

const metaLabelFor = (item) => {
  if (item.kind === 'note') return t(`news.category-${item.category}`)
  if (item.kind === 'food-shared') {
    return item.isOwn ? t('news.your-contribution') : t('news.community')
  }
  if (item.kind === 'post') return t('news.post')
  return t('news.only-you')
}
// Render authored text without v-html while turning bare HTTPS URLs into links.
// Separate patterns avoid the stateful lastIndex of a reused global regex.
const URL_SPLIT = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g
const URL_MATCH = /^https?:\/\//

const bodyParts = (text) =>
  (text ?? '')
    .split(URL_SPLIT)
    .filter((part) => part !== '')
    .map((part, index) => ({ key: index, text: part, href: URL_MATCH.test(part) ? part : null }))

// SSR formats instants in UTC for stable hydration; mounted clients use local
// time. `now` keeps relative labels reactive across day boundaries.
const dateLocales = { en: enUS, de, es, fr }

const now = ref(new Date())
const mounted = ref(false)
let clock = null

onMounted(() => {
  mounted.value = true
  clock = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onUnmounted(() => clearInterval(clock))

// Milestones are calendar dates; notes and food shares are instants.
const entryDate = (item) => (item.date ? parseISO(item.date) : new Date(newsEntryTimestamp(item)))

const formatDate = (item) => {
  const value = entryDate(item)
  const dateLocale = dateLocales[locale.value] ?? enUS
  // Read first, unconditionally, so the render always subscribes to the clock.
  const currently = now.value

  if (!mounted.value) {
    // A calendar day has no timezone to be wrong about; an instant does.
    return format(item.date ? value : utcDayForLocalFormatting(value), 'PP', {
      locale: dateLocale
    })
  }

  const daysAgo = differenceInCalendarDays(currently, value)
  if (daysAgo === 0) return t('news.today')
  if (daysAgo === 1) return t('news.yesterday')
  if (daysAgo < 7 && daysAgo > 0) {
    return formatDistanceToNow(value, { addSuffix: true, locale: dateLocale })
  }
  return format(value, 'PP', { locale: dateLocale })
}

const emojiFor = (item) => {
  if (item.kind === 'note') return { new: '✨', improved: '🔧', tip: '💡' }[item.category]
  if (item.kind === 'streak') return '🔥'
  if (item.kind === 'post') return '💬'
  return item.food.emoji || '🌱'
}

const vote = async (item, value) => {
  if (!item.food || votingKey.value) return
  votingKey.value = item.key
  try {
    await voteCommunityFood({ communityFoodKey: item.food['.key'], vote: value })
  } catch {
    // The shared error handler has already reported it; the realtime listener
    // keeps the card truthful either way.
  } finally {
    votingKey.value = null
  }
}

// Visiting counts as seeing in this browser. The frozen `seen` value keeps the
// unread labels visible for this visit. Time never moves backwards; revision
// advances separately so a late, backdated release note cannot rewind it.
const captured = ref(false)

watch(
  [items, commentEntries, seenState.ready],
  ([list, comments, ready]) => {
    if (!ready) return
    const stored = {
      lastReadAt: seenState.lastReadAt.value,
      lastSeenRevision: seenState.lastSeenRevision.value
    }

    if (!captured.value) {
      captured.value = true
      seen.value = stored
    }

    const covered = seenAfterVisit([...list, ...comments])
    if (covered.lastReadAt !== null) seenState.markReadAt(covered.lastReadAt)
    if (covered.lastSeenRevision !== null) seenState.markRevision(covered.lastSeenRevision)
  },
  { immediate: true }
)

definePageMeta({
  i18n: {
    paths: {
      en: '/news',
      de: '/neuigkeiten',
      es: '/novedades',
      fr: '/actualites'
    }
  }
})

useSeoMeta({
  title: () => t('news.title'),
  description: () => t('news.description')
})

defineOgImage('Default', {
  title: () => t('news.title') + ' - PKU Tools',
  description: () => t('news.description')
})
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader :title="$t('news.title')" />
    <p class="-mt-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
      {{ userIsAuthenticated ? $t('news.subtitle') : $t('news.subtitle-signed-out') }}
    </p>

    <div
      v-if="!userIsAuthenticated"
      class="mb-6 rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:ring-sky-800"
    >
      <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">{{ $t('news.sign-in') }}</p>
      <PrimaryButton :text="$t('sign-in.title')" @click="navigateTo(localePath('sign-in'))" />
    </div>

    <!-- Derived account notices appear above chronological entries. -->
    <div v-if="allNotices.length" class="mb-4 space-y-2">
      <NuxtLink
        v-for="notice in visibleNotices"
        :key="notice.key"
        :to="localePath({ name: 'news', hash: `#${noticeTarget(notice)}` }, notice.language)"
        :class="[
          'block rounded-lg px-3 py-2 text-sm text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-gray-300',
          isWarningNotice(notice)
            ? 'bg-amber-50 ring-1 ring-amber-200 hover:ring-amber-300 focus-visible:outline-amber-500 dark:bg-amber-950/30 dark:ring-amber-900'
            : 'bg-black/5 hover:bg-black/10 focus-visible:outline-sky-500 dark:bg-white/15 dark:hover:bg-white/10'
        ]"
        @click="viewNotice($event, notice)"
      >
        <span
          v-if="isNoticeUnread(notice)"
          class="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-500 align-middle dark:bg-sky-400"
        >
          <span class="sr-only">{{ $t('news.unread-item') }}</span>
        </span>
        <span class="font-medium break-words text-gray-900 dark:text-white"
          >{{ notice.name }}:</span
        >
        <span v-if="notice.pendingCommentAt">{{ ' ' + $t('news.notice-own-comment-text') }}</span>
        <span v-if="notice.hasNegativeFeedback">
          {{ ' ' + $t('news.notice-own-flag-text', { count: notice.netDislikes }) }}
        </span>
        <span v-if="notice.isHidden">{{ ' ' + $t('news.notice-own-flag-hidden') }}</span>
        {{ ' ' }}
        <span class="inline-block font-medium text-sky-600 dark:text-sky-400">
          {{ notice.postKey ? $t('news.notice-post-action') : $t('news.notice-own-flag-action') }}
          →
        </span>
      </NuxtLink>
      <button
        v-if="additionalNoticeCount > 0"
        type="button"
        :aria-expanded="showAllNotices"
        class="cursor-pointer rounded px-1 py-2 text-sm font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
        @click="showAllNotices = !showAllNotices"
      >
        {{
          showAllNotices
            ? $t('news.fewer-notices')
            : $t('news.more-notices', { count: allNotices.length })
        }}
      </button>
    </div>

    <NewsPostComposer v-if="userIsAuthenticated" @posted="selectedFilter = 'all'" />

    <div
      v-if="showFilters"
      class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <nav class="flex flex-wrap gap-2" :aria-label="$t('news.filter-label')">
        <button
          v-for="filter in availableFilters"
          :key="filter.key"
          type="button"
          :aria-pressed="selectedFilter === filter.key"
          :class="[
            'cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors',
            selectedFilter === filter.key
              ? 'bg-sky-50 text-sky-700 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700'
              : 'text-gray-600 ring-gray-300 hover:text-sky-600 hover:ring-sky-400 dark:text-gray-400 dark:ring-gray-700 dark:hover:text-sky-400'
          ]"
          @click="selectedFilter = filter.key"
        >
          {{ $t(filter.label) }}
        </button>
      </nav>
      <label
        v-if="hasHiddenFoods"
        class="ml-auto flex min-h-9 shrink-0 cursor-pointer items-center gap-2 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400"
      >
        <span>{{ $t('news.show-hidden-foods') }}</span>
        <ToggleSwitch
          v-model="showHiddenFoods"
          small
          thin
          :label="$t('news.show-hidden-foods')"
          class="opacity-75 hover:opacity-100 focus-visible:opacity-100"
        />
      </label>
    </div>

    <p v-if="items.length === 0" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ $t('news.empty') }}
    </p>

    <template v-for="item in shownItems" :key="item.key">
      <article
        :id="item.key"
        tabindex="-1"
        :class="[
          'mb-3 scroll-mt-24 rounded-xl bg-white p-4 shadow-sm ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-gray-900',
          isItemUnread(item) ? 'ring-sky-300 dark:ring-sky-700' : 'ring-gray-200 dark:ring-gray-700'
        ]"
      >
        <!-- Fixed-height metadata keeps short titles aligned across card types. -->
        <div class="flex items-center">
          <span class="flex h-9 w-7 shrink-0 items-center justify-start text-lg">
            {{ emojiFor(item) }}
          </span>

          <div class="flex min-h-9 min-w-0 flex-1 items-center gap-2">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm leading-5 font-semibold break-words text-gray-900 dark:text-white">
                {{ titleFor(item) }}
                <LucideBadgeCheck
                  v-if="item.post && isOfficial(item.post.authorId)"
                  class="mb-0.5 inline h-4 w-4 text-sky-600 dark:text-sky-400"
                  aria-hidden="true"
                />
                <span
                  v-if="item.isHidden"
                  class="ml-1 inline-flex items-center rounded bg-amber-50 px-1.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  :title="$t('news.hidden-description')"
                >
                  {{ $t('news.hidden') }}
                </span>
                <span
                  v-if="isHiddenByAdmin(item.post ?? item.food)"
                  class="ml-1 inline-flex items-center gap-1 rounded bg-gray-200 px-1.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                >
                  <LucideEyeOff class="h-3 w-3" aria-hidden="true" />
                  {{ $t('news.hidden-by-admin') }}
                </span>
              </h3>
            </div>
            <div class="flex h-9 shrink-0 flex-col items-end justify-between">
              <div class="flex items-center gap-1">
                <span
                  v-if="isItemUnread(item)"
                  class="h-2 w-2 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400"
                >
                  <span class="sr-only">{{ $t('news.unread-item') }}</span>
                </span>
                <time
                  class="text-xs leading-4 text-gray-400 dark:text-gray-500"
                  :datetime="item.date || new Date(newsEntryTimestamp(item)).toISOString()"
                >
                  {{ formatDate(item) }}
                </time>
              </div>
              <span class="text-xs leading-4 whitespace-nowrap text-gray-400 dark:text-gray-500">
                {{ metaLabelFor(item) }}
              </span>
            </div>
          </div>
        </div>

        <p
          v-if="bodyFor(item)"
          :class="[
            'mt-2',
            item.kind === 'note'
              ? 'text-sm text-gray-700 dark:text-gray-300'
              : 'text-xs text-gray-500 dark:text-gray-400'
          ]"
        >
          <template v-for="part in bodyParts(bodyFor(item))" :key="part.key">
            <a
              v-if="part.href"
              :href="part.href"
              rel="external nofollow noopener"
              target="_blank"
              class="break-all text-sky-600 hover:underline dark:text-sky-400"
              >{{ part.text }}</a
            ><template v-else>{{ part.text }}</template>
          </template>
        </p>

        <NewsCommunityFood
          v-if="item.food"
          v-model:comments-expanded="expandedComments[item.key]"
          :food="item.food"
          :vote="voteFor(item)"
          :can-vote="canVote(item)"
          :show-statistics="item.isOwn"
          :current-user-id="userId"
          :busy="votingKey === item.key"
          @vote="(value) => vote(item, value)"
        />

        <NewsCommunityPost
          v-if="item.post"
          v-model:comments-expanded="expandedComments[item.key]"
          :post="item.post"
          :is-own="item.isOwn"
          :current-user-id="userId"
        />
      </article>
      <hr v-if="item.key === pinnedItem?.key" class="mb-3 border-gray-300 dark:border-gray-700" />
    </template>

    <button
      v-if="hasMore"
      type="button"
      class="mb-3 w-full cursor-pointer rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-sky-400 hover:text-sky-600 dark:border-gray-700 dark:text-gray-400 dark:hover:text-sky-400"
      @click="loadMore"
    >
      {{ $t('news.load-more') }}
    </button>
  </div>
</template>
