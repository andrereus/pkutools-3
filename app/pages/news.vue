<script setup>
import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from 'date-fns'
import { enUS, de, es, fr } from 'date-fns/locale'
import { useStore } from '../../stores/index'
import {
  emptySeen,
  filterNewsItems,
  hasEnoughCommunityItemsForFilter,
  isUnread,
  NEWS_PAGE_SIZE,
  seenAfterVisit,
  utcDayForLocalFormatting,
  visibleNewsItems
} from '../utils/news-grouping'

// Combines the authored changelog with entries derived from existing store data.

const store = useStore()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { voteCommunityFood } = useApi()
const { items, notices, userIsAuthenticated } = useNews()
const seenState = useNewsSeen()

const userId = computed(() => store.user?.id ?? null)
const votingKey = ref(null)

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
  { key: 'food-shared', label: 'news.filter-community' },
  { key: 'streak', label: 'news.filter-personal' }
]

const showFilters = computed(() => userIsAuthenticated.value)
// Community remains in All at low volume but gets its own filter once useful.
const showCommunityFilter = computed(() => hasEnoughCommunityItemsForFilter(items.value))
const availableFilters = computed(() =>
  filterDefinitions.filter(
    (filter) =>
      filter.key === 'all' ||
      (filter.key === 'food-shared'
        ? showCommunityFilter.value && items.value.some((item) => item.kind === filter.key)
        : items.value.some((item) => item.kind === filter.key))
  )
)
const filteredItems = computed(() =>
  filterNewsItems(items.value, showFilters.value ? selectedFilter.value : 'all')
)

watch(showFilters, (shown) => {
  if (!shown) selectedFilter.value = 'all'
})
watch(availableFilters, (filters) => {
  if (!filters.some((filter) => filter.key === selectedFilter.value)) {
    selectedFilter.value = 'all'
  }
})
watch(selectedFilter, () => {
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
const hasMore = computed(
  () => userIsAuthenticated.value && visibleItems.value.length < filteredItems.value.length
)
const loadMore = () => {
  visibleCount.value += PAGE_SIZE
}

const titleFor = (item) => {
  if (item.kind === 'note') return item.title
  if (item.kind === 'streak') return t('news.streak-title', { days: item.count })
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
const entryDate = (item) => (item.date ? parseISO(item.date) : new Date(item.createdAt))

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
  [items, seenState.ready],
  ([list, ready]) => {
    if (!ready) return
    const stored = {
      lastReadAt: seenState.lastReadAt.value,
      lastSeenRevision: seenState.lastSeenRevision.value
    }

    if (!captured.value) {
      captured.value = true
      seen.value = stored
    }

    const covered = seenAfterVisit(list)
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
    <NuxtLink
      v-for="notice in notices"
      :key="notice.key"
      :to="localePath(notice.route)"
      class="mb-3 block rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 hover:ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-900"
    >
      <p class="font-semibold text-gray-900 dark:text-white">
        {{ $t(`news.notice-${notice.kind}-title`, notice.params || {}) }}
      </p>
      <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
        {{ $t(`news.notice-${notice.kind}-text`, notice.params || {}) }}
      </p>
      <span class="mt-2 inline-block text-sm font-semibold text-sky-600 dark:text-sky-400">
        {{ $t(`news.notice-${notice.kind}-action`) }} →
      </span>
    </NuxtLink>

    <nav v-if="showFilters" class="mb-4 flex flex-wrap gap-2" :aria-label="$t('news.filter-label')">
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

    <p v-if="items.length === 0" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ $t('news.empty') }}
    </p>

    <article
      v-for="item in visibleItems"
      :key="item.key"
      :class="[
        'mb-3 rounded-xl bg-white p-4 shadow-sm ring-1 dark:bg-gray-900',
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
                :datetime="item.date || new Date(item.createdAt).toISOString()"
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
        :food="item.food"
        :vote="voteFor(item)"
        :can-vote="canVote(item)"
        :show-statistics="item.isOwn"
        :current-user-id="userId"
        :busy="votingKey === item.key"
        @vote="(value) => vote(item, value)"
      />
    </article>

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
