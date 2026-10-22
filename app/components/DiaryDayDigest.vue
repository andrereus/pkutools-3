<script setup>
import { format } from 'date-fns'
import { entriesOfDay, entriesOfToday } from '../utils/day-digest'
import { isUnread } from '../utils/news-grouping'

// What happened on a diary day besides the log, as compact pills that each
// open the item in News, so an empty day is not a blank page. On today the
// reader's open notifications come first, and the day reaches back 24 hours.
const props = defineProps({
  /** The diary day, as yyyy-MM-dd. */
  date: { type: String, required: true },
  isToday: { type: Boolean, default: false }
})

const NOTICE_LIMIT = 2
const ENTRY_LIMIT = 3
const NOTE_EMOJI = { new: '✨', improved: '🔧', tip: '💡' }

const { t, locale } = useI18n()
const localePath = useLocalePath()
// The day's posts load for this day only; the feed holds just the newest.
const dayPosts = useDayPosts(toRef(props, 'date'), toRef(props, 'isToday'))
const {
  foodEntries,
  postEntries,
  milestoneEntries,
  notices,
  postNotices,
  threadNotices,
  userIsAuthenticated
} = useNewsContext({ extraPosts: dayPosts })
const seenState = useNewsSeen()
const changelog = useChangelogNotes()

// Read state is browser-local; until it has loaded, nothing counts as unread.
const seen = computed(() =>
  seenState.ready.value
    ? { lastReadAt: seenState.lastReadAt.value, lastSeenRevision: seenState.lastSeenRevision.value }
    : null
)

// Notices last until the comments have been opened, as in News.
const allNotices = computed(() => {
  if (!props.isToday || !userIsAuthenticated.value) return []
  return [...notices.value, ...postNotices.value, ...threadNotices.value].sort(
    (left, right) => (right.pendingCommentAt ?? 0) - (left.pendingCommentAt ?? 0)
  )
})
const visibleNotices = computed(() => allNotices.value.slice(0, NOTICE_LIMIT))

// The same wording as the notices in News, for foods and posts alike.
const noticeText = (notice) => {
  const parts = [
    notice.pendingCommentAt ? t('news.notice-own-comment-text') : null,
    notice.hasNegativeFeedback
      ? t('news.notice-own-flag-text', { count: notice.netDislikes })
      : null,
    notice.isHidden ? t('news.notice-own-flag-hidden') : null
  ].filter(Boolean)
  return `${notice.name}: ${parts.join(' ')}`
}
// A food that collects dislikes or is hidden needs checking; a new comment
// does not.
const isWarning = (notice) => !notice.postKey && (notice.hasNegativeFeedback || notice.isHidden)

// Unread as in News and the bell: newer than the reader's last News visit,
// for notices as for the day's items. Viewing the diary marks nothing as read.
// A rating warning has no moment to be new, so amber is its only mark.
const isNoticeUnread = (notice) =>
  !!seen.value &&
  !!notice.pendingCommentAt &&
  isUnread({ key: notice.key, createdAt: notice.pendingCommentAt }, seen.value)
const isEntryUnread = (entry) => !!seen.value && isUnread(entry, seen.value)

const noticeLink = (notice) =>
  localePath(
    {
      name: 'news',
      hash: notice.postKey ? `#post-${notice.postKey}` : `#food-${notice.foodKey}`
    },
    notice.language
  )

// An update published behind its date arrives after the reader's last News
// visit but is dated before it, so its own day would hide it. It shows on
// today until News has been visited, then returns to the day it is dated.
const arrivedLate = (note) => {
  const state = seen.value
  return (
    state !== null &&
    state.lastReadAt !== null &&
    state.lastSeenRevision !== null &&
    note.revision > state.lastSeenRevision &&
    note.createdAt <= state.lastReadAt
  )
}

const noteEntries = computed(() => {
  const today = format(new Date(), 'yyyy-MM-dd')
  return changelog.value.map((note) => {
    const entry = {
      key: `note-${note.revision}`,
      kind: 'note',
      createdAt: new Date(note.publishedAt).getTime(),
      revision: note.revision,
      category: note.category,
      title: (note[locale.value] ?? note.en).title
    }
    return arrivedLate(entry) ? { ...entry, date: today } : entry
  })
})

// Keeps today's 24-hour window moving while the diary stays open.
const now = ref(Date.now())
let clock = null
onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})
onUnmounted(() => clearInterval(clock))

const entries = computed(() => {
  if (!userIsAuthenticated.value) return []
  const all = [
    ...milestoneEntries.value,
    ...postEntries.value,
    ...foodEntries.value,
    ...noteEntries.value
  ]
  return props.isToday ? entriesOfToday(all, now.value) : entriesOfDay(all, props.date)
})
const visibleEntries = computed(() => entries.value.slice(0, ENTRY_LIMIT))

const hiddenCount = computed(
  () =>
    allNotices.value.length -
    visibleNotices.value.length +
    entries.value.length -
    visibleEntries.value.length
)
// Opens News where the first item left out here is; notices are at the top.
const moreLink = computed(() =>
  entries.value.length > ENTRY_LIMIT
    ? localePath({ name: 'news', hash: `#${entries.value[ENTRY_LIMIT].key}` })
    : localePath('news')
)

const countOf = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0)

const emojiFor = (entry) => {
  if (entry.kind === 'streak') return '🔥'
  if (entry.kind === 'post') return '💬'
  if (entry.kind === 'note') return NOTE_EMOJI[entry.category] ?? '✨'
  return entry.food.emoji || '🌱'
}

const textFor = (entry) => {
  if (entry.kind === 'streak') return t('news.streak-title', { days: entry.count })
  if (entry.kind === 'post') return entry.post.text.trim().split('\n')[0]
  if (entry.kind === 'note') return entry.title
  return entry.food.name
}

// The reactions an item has, as in its News card: likes on a post, ratings on
// a food, and the comments on either.
const figuresFor = (entry) => {
  const record = entry.post ?? entry.food
  if (!record) return []
  return [
    { key: 'likes', icon: entry.post ? 'heart' : 'thumbs-up', count: countOf(record.likes) },
    { key: 'comments', icon: 'comment', count: countOf(record.commentCount) }
  ].filter((figure) => figure.count > 0)
}

const pillClass =
  'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500'
</script>

<template>
  <section
    v-if="allNotices.length > 0 || entries.length > 0"
    class="mb-6"
    :aria-label="$t('news.title')"
  >
    <div class="flex items-center justify-between px-1">
      <h2 class="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
        {{ $t('news.title') }}
      </h2>
      <ActionChip v-if="hiddenCount > 0" :to="moreLink">
        {{ $t('diary.on-this-day-all', { count: allNotices.length + entries.length }) }}
        <LucideChevronRight class="-mr-1 h-4 w-4" aria-hidden="true" />
      </ActionChip>
    </div>

    <ul class="mt-2 flex flex-wrap gap-2">
      <!-- Notifications: amber only for a rating warning, otherwise the
           see-through gray of the other pills, which shows on every theme -->
      <li v-for="notice in visibleNotices" :key="notice.key" class="max-w-[calc(50%-0.25rem)]">
        <NuxtLink
          :to="noticeLink(notice)"
          :title="noticeText(notice)"
          :class="[
            pillClass,
            isWarning(notice)
              ? 'bg-amber-50 text-gray-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-gray-300 dark:ring-amber-900 dark:hover:bg-amber-950/50'
              : 'bg-black/5 text-gray-900 hover:bg-black/10 dark:bg-white/15 dark:text-gray-300 dark:hover:bg-white/10'
          ]"
        >
          <span class="shrink-0" aria-hidden="true">🔔</span>
          <span class="min-w-0 truncate">{{ noticeText(notice) }}</span>
          <span
            v-if="isNoticeUnread(notice)"
            class="h-2 w-2 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400"
          >
            <span class="sr-only">{{ $t('news.unread-item') }}</span>
          </span>
        </NuxtLink>
      </li>

      <li v-for="entry in visibleEntries" :key="entry.key" class="max-w-[calc(50%-0.25rem)]">
        <NuxtLink
          :to="localePath({ name: 'news', hash: `#${entry.key}` })"
          :title="textFor(entry)"
          :class="[
            pillClass,
            'bg-black/5 text-gray-900 hover:bg-black/10 dark:bg-white/15 dark:text-gray-300 dark:hover:bg-white/10'
          ]"
        >
          <span class="shrink-0" aria-hidden="true">{{ emojiFor(entry) }}</span>
          <span class="min-w-0 truncate">{{ textFor(entry) }}</span>
          <span
            v-for="figure in figuresFor(entry)"
            :key="figure.key"
            class="inline-flex shrink-0 items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400"
          >
            <LucideHeart v-if="figure.icon === 'heart'" class="h-3.5 w-3.5" aria-hidden="true" />
            <LucideThumbsUp
              v-else-if="figure.icon === 'thumbs-up'"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            />
            <LucideMessageCircle v-else class="h-3.5 w-3.5" aria-hidden="true" />
            {{ figure.count }}
          </span>
          <span
            v-if="isEntryUnread(entry)"
            class="h-2 w-2 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400"
          >
            <span class="sr-only">{{ $t('news.unread-item') }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
