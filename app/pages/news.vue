<script setup>
import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from 'date-fns'
import { enUS, de, es, fr } from 'date-fns/locale'
import { useStore } from '../../stores/index'
import {
  emptySeen,
  isUnread,
  seenAfterVisit,
  utcDayForLocalFormatting,
  visibleNewsItems
} from '../utils/news-grouping'

// News: what has changed in the app, and what the community has shared.
//
// Nothing on this page is stored for it. Release notes come from a file in the
// repository, so they are in the server-rendered HTML — which is also what makes
// the changelog indexable for anyone who is not signed in. Community entries are
// derived from the community foods the app already loads, and the reader's own
// milestones from the dates already in their diary.

const store = useStore()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { voteCommunityFood } = useApi()
const { items, notices, userIsAuthenticated } = useNews()
const seenState = useNewsSeen()

const userId = computed(() => store.user?.id ?? null)
const votingKey = ref(null)

// Voting is offered where there is something to decide: a signed-in reader, and
// not one of their own foods, which the vote route refuses anyway. Whose food it
// is was already worked out when the entry was built.
const canVote = (item) => userIsAuthenticated.value && !!item.food && !item.isOwn
const voteFor = (item) => (userId.value ? (item.food?.voterIds?.[userId.value] ?? null) : null)

// Paging, by date — but only for someone signed in.
//
// The two readers are looking at different lists. Signed in, this is a feed:
// release notes mixed with community foods and the reader's own milestones,
// growing for as long as they use the app, so it has to end somewhere and
// continue on a button.
//
// Signed out — which is every crawler, since none of them has an account — the
// list is nothing but the changelog. That is finite, authored, and its whole
// value is being complete and indexable: a changelog page truncated at twenty
// entries is one that mostly is not there. So it is rendered whole. Nobody but
// the operator can add to it, so there is no volume to defend against.
const PAGE_SIZE = 20
const visibleCount = ref(PAGE_SIZE)

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
  visibleNewsItems(items.value, visibleCount.value, userIsAuthenticated.value)
)
const hasMore = computed(
  () => userIsAuthenticated.value && visibleItems.value.length < items.value.length
)
const loadMore = () => {
  visibleCount.value += PAGE_SIZE
}

const titleFor = (item) => {
  if (item.kind === 'note') return item.title
  if (item.kind === 'streak') return t('news.streak-title', { days: item.count })
  return item.food.name
}
// Foods need no generic body saying that they are foods: their values and vote
// controls already make that clear, and repeating it on every entry costs a
// line. The shared metadata column identifies them instead.
const bodyFor = (item) => {
  if (item.kind === 'note') return item.body
  if (item.kind === 'streak') return t('news.streak-text')
  return null
}

// Every kind gets one compact label below its date. Keeping that metadata in a
// fixed two-row column makes short and long titles use the same header shape.
const metaLabelFor = (item) => {
  if (item.kind === 'note') return t(`news.category-${item.category}`)
  if (item.kind === 'food-shared') {
    return item.isOwn ? t('news.your-contribution') : t('news.community')
  }
  return t('news.only-you')
}
// Changelog bodies are plain text, and rendering authored markup would mean
// trusting a file through v-html for no gain. Bare URLs are still links though,
// and an entry that reads "New video: https://..."
// with nothing to click is just a broken entry. So the text is split around URLs
// and only those pieces become anchors.
//
// Two copies of the pattern on purpose. A global regex carries a lastIndex
// between calls, so reusing the splitting one to test each piece would report
// every other match as plain text.
const URL_SPLIT = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g
const URL_MATCH = /^https?:\/\//

const bodyParts = (text) =>
  (text ?? '')
    .split(URL_SPLIT)
    .filter((part) => part !== '')
    .map((part, index) => ({ key: index, text: part, href: URL_MATCH.test(part) ? part : null }))

// Dates, the way the rest of the app writes them: date-fns with the locale
// object, not toLocaleDateString, so News reads like the diary and the report.
//
// Two things have to hold at once.
//
// Hydration: the server has no idea where the reader is, so anything it renders
// from an instant must not depend on a timezone. `2026-08-28T15:10:55Z` is the
// 28th in UTC and already the 29th in Kiritimati, and formatting it locally on
// both sides produces two different strings for the same node. So until mounted,
// instants are read in UTC — the server and the browser's first render then
// agree by construction — and the reader's own timezone takes over afterwards.
//
// Reactivity: every label is derived from `now`, and `now` is read before any
// branch that could return early. A label that never touched it would never
// re-render when the clock moved, so "Today" would still say today tomorrow.
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

// A milestone is a calendar day and is parsed as one, landing on local midnight
// and formatting as the day it names anywhere. A note or a food is an instant.
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

    <!-- Facts about this reader's own account. Pinned rather than dated,
         because they are things to deal with rather than things that happened,
         and each one disappears by itself once it is dealt with. -->
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
      <!-- A fixed-height header keeps a short title centered against the icon
           and the two-row metadata column. Longer titles grow naturally;
           descriptions and food details use the full card width below. -->
      <div class="flex items-center">
        <span class="flex h-9 w-7 shrink-0 items-center justify-start text-lg">
          {{ emojiFor(item) }}
        </span>

        <div class="flex min-h-9 min-w-0 flex-1 items-center gap-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
            <h3 class="text-sm leading-5 font-semibold break-words text-gray-900 dark:text-white">
              {{ titleFor(item) }}
            </h3>
            <span
              v-if="isItemUnread(item)"
              class="text-[10px] leading-4 font-semibold text-amber-700 dark:text-amber-300"
            >
              {{ $t('news.unread-item') }}
            </span>
          </div>
          <div class="flex h-9 shrink-0 flex-col items-end justify-between">
            <time
              class="text-xs leading-4 text-gray-400 dark:text-gray-500"
              :datetime="item.date || new Date(item.createdAt).toISOString()"
            >
              {{ formatDate(item) }}
            </time>
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
