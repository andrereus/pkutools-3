<script setup>
import {
  getDatabase,
  onValue,
  query,
  ref as databaseRef,
  orderByChild,
  limitToLast,
  startAt,
  equalTo
} from 'firebase/database'
import { useStore } from '../../stores/index'
import { communityFoodScore, isCommunityFoodHidden } from '../utils/community-food'
import { isHiddenByAdmin } from '../utils/hidden-content'
import { ADMIN_MODERATION } from '../composables/useCommunityFoodComments'

// Moderation: posts and foods in all languages, sorted by their latest
// activity, so a new comment brings its post or food to the top. Comments are
// moderated inside their card's thread. Posts, foods and comments can be
// removed: hidden in place, quickly and reversibly. Deleting is final.
// Admin-only; every action is checked server-side.

const store = useStore()
const {
  voteCommunityFood,
  adminDeleteCommunityPost,
  adminDeleteCommunityFood,
  adminDeleteComment,
  adminDeleteCommunityName,
  adminSetHidden
} = useApi()
const { confirm } = useConfirm()
const notifications = useNotifications()
const { nameOf, isOfficial } = useCommunityAuthor()
const { locale, t } = useI18n()

const PAGE_SIZE = 20
// 'all', or 'hidden' for what is hidden at the moment.
const view = ref('all')
const search = ref('')
// Null for everything, or { userId } for one account's content.
const filter = ref(null)
const visibleCount = ref(PAGE_SIZE)
const busyKey = ref(null)
const votingKey = ref(null)
// Which cards have their comments open. Cards with comments start open.
const expanded = ref({})
const userId = computed(() => store.user?.id ?? null)

watch([view, filter], () => {
  visibleCount.value = PAGE_SIZE
})

// Posts load from the database by what is on screen: the most active, as many
// as are shown; all hidden ones; and all of one account when filtered by it.
// Foods are loaded for the whole app.
//
// A post's latest activity is the newest of three times it already has: when
// it was written or edited, and its newest comment by others or by its author.
// The most active N posts are always among the N newest by one of those
// times, so one query per time covers them.
const ACTIVITY_FIELDS = ['updatedAt', 'lastCommunityCommentAt', 'lastAuthorCommentAt']
const activityPosts = Object.fromEntries(ACTIVITY_FIELDS.map((field) => [field, ref({})]))
const activityLoaded = ref({})
const hiddenPosts = ref({})
const postsWithHiddenComments = ref({})
const userPosts = ref({})
const windowLoaded = computed(() => ACTIVITY_FIELDS.every((field) => activityLoaded.value[field]))
const listeners = new Map()

const listen = (name, postsQuery, target, onLoad) => {
  listeners.get(name)?.()
  listeners.delete(name)
  if (!postsQuery) {
    target.value = {}
    return
  }
  listeners.set(
    name,
    onValue(postsQuery, (snapshot) => {
      target.value = snapshot.val() ?? {}
      onLoad?.()
    })
  )
}
const postsRef = () => databaseRef(getDatabase(), 'communityPosts')

watch(
  [() => store.isAdmin, visibleCount],
  ([admin, count]) => {
    if (!admin || !import.meta.client) {
      // Signing out ends every listener; signing back in binds them anew.
      listeners.forEach((unsubscribe) => unsubscribe())
      listeners.clear()
      activityLoaded.value = {}
      return
    }
    activityLoaded.value = {}
    for (const field of ACTIVITY_FIELDS) {
      listen(
        field,
        query(postsRef(), orderByChild(field), limitToLast(count)),
        activityPosts[field],
        () => {
          activityLoaded.value = { ...activityLoaded.value, [field]: true }
        }
      )
    }
    if (!listeners.has('hidden')) {
      listen('hidden', query(postsRef(), orderByChild('hiddenAt'), startAt(1)), hiddenPosts)
      listen(
        'hiddenComments',
        query(postsRef(), orderByChild('hiddenCommentCount'), startAt(1)),
        postsWithHiddenComments
      )
    }
  },
  { immediate: true }
)
watch(
  [() => store.isAdmin, () => filter.value?.userId],
  ([admin, authorId]) => {
    if (!admin || !import.meta.client) return
    listen(
      'user',
      authorId ? query(postsRef(), orderByChild('authorId'), equalTo(authorId)) : null,
      userPosts
    )
  },
  { immediate: true }
)
onUnmounted(() => listeners.forEach((unsubscribe) => unsubscribe()))

const latest = (...values) =>
  Math.max(0, ...values.filter((value) => Number.isSafeInteger(value) && value > 0))
const isEdited = (createdAt, updatedAt) => latest(updatedAt) > latest(createdAt)
const countOf = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0)

const postRow = (key, post) => ({
  key: `post-${key}`,
  type: 'post',
  id: key,
  authorId: post.authorId,
  language: post.language,
  at: latest(post.createdAt, post.updatedAt, post.lastCommunityCommentAt, post.lastAuthorCommentAt),
  edited: isEdited(post.createdAt, post.updatedAt),
  hidden: isHiddenByAdmin(post),
  hiddenCommentCount: countOf(post.hiddenCommentCount),
  commentCount: countOf(post.commentCount),
  text: post.text,
  post: { ...post, '.key': key }
})

const foodRow = (food) => ({
  key: `food-${food['.key']}`,
  type: 'food',
  id: food['.key'],
  authorId: food.contributorId,
  language: food.language,
  // Foods have no stored activity time; their own times stand in.
  at: latest(
    food.createdAt,
    food.contentUpdatedAt,
    food.lastCommunityCommentAt,
    food.lastContributorCommentAt
  ),
  edited: isEdited(food.createdAt, food.contentUpdatedAt),
  hidden: isHiddenByAdmin(food),
  hiddenCommentCount: countOf(food.hiddenCommentCount),
  commentCount: countOf(food.commentCount),
  hiddenByRatings: isCommunityFoodHidden(communityFoodScore(food)),
  text: food.name,
  note: food.note,
  food
})

const byActivity = (left, right) => right.at - left.at

const postRowsOf = (...sources) => {
  const byKey = {}
  for (const source of sources) Object.assign(byKey, source)
  return Object.entries(byKey).map(([key, post]) => postRow(key, post))
}

// A post or food that is hidden itself, or holds hidden comments.
const holdsHidden = (row) => row.hidden || row.hiddenCommentCount > 0

// The list on screen. A post among the first N rows by activity is always
// among the N most active posts, so the activity queries are enough.
const rows = computed(() => {
  if (view.value === 'hidden') {
    return [
      ...postRowsOf(hiddenPosts.value, postsWithHiddenComments.value),
      ...store.communityFoods.map(foodRow)
    ]
      .filter(holdsHidden)
      .sort(byActivity)
  }
  if (filter.value) {
    return [
      ...postRowsOf(userPosts.value),
      ...store.communityFoods
        .filter((food) => food.contributorId === filter.value.userId)
        .map(foodRow)
    ].sort(byActivity)
  }
  return [
    ...postRowsOf(...ACTIVITY_FIELDS.map((field) => activityPosts[field].value)),
    ...store.communityFoods.map(foodRow)
  ]
    .sort(byActivity)
    .slice(0, visibleCount.value)
})
const hiddenCount = computed(
  () =>
    postRowsOf(hiddenPosts.value, postsWithHiddenComments.value).filter(holdsHidden).length +
    store.communityFoods.map(foodRow).filter(holdsHidden).length
)

// Search narrows what is loaded; the user filter loads all of one account.
const visibleRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return rows.value
  return rows.value.filter((row) =>
    [row.text, row.note, row.authorId, nameOf(row.authorId)].some(
      (field) => typeof field === 'string' && field.toLowerCase().includes(term)
    )
  )
})
const hasMore = computed(
  () =>
    view.value === 'all' &&
    !filter.value &&
    windowLoaded.value &&
    (ACTIVITY_FIELDS.some(
      (field) => Object.keys(activityPosts[field].value).length >= visibleCount.value
    ) ||
      rows.value.length >= visibleCount.value)
)

// Threads with comments start open, so new ones are seen without a click.
watch(
  rows,
  (list) => {
    for (const row of list) {
      if (
        expanded.value[row.key] === undefined &&
        (row.commentCount > 0 || row.hiddenCommentCount > 0)
      ) {
        expanded.value[row.key] = true
      }
    }
  },
  { immediate: true }
)

const showUser = (authorId) => {
  if (typeof authorId === 'string' && authorId) filter.value = { userId: authorId }
}

// Admins vote like anyone else, except on their own foods.
const voteOf = (food) => (userId.value ? (food.voterIds?.[userId.value] ?? null) : null)
const vote = async (row, value) => {
  if (votingKey.value) return
  votingKey.value = row.key
  try {
    await voteCommunityFood({ communityFoodKey: row.id, vote: value })
  } catch {
    // useApi already reports the error; the listener keeps the card truthful.
  } finally {
    votingKey.value = null
  }
}

const emojiFor = (row) => (row.type === 'food' ? row.food.emoji || '🌱' : '💬')

const authorText = (row) => {
  if (isOfficial(row.authorId)) return 'PKU Tools'
  if (typeof row.authorId !== 'string') return t('admin.unknown-user')
  const shortId = row.authorId.slice(0, 8)
  const name = nameOf(row.authorId)
  return name ? `${name} (${shortId})` : t('admin.user', { id: shortId })
}

// What kind of content it is is in the action line under the author.
const metaLabel = (row) =>
  [(row.language ?? '—').toUpperCase(), row.edited ? t('admin.edited') : null]
    .filter(Boolean)
    .join(' · ')

const formatDate = (timestamp) =>
  timestamp > 0
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
        timestamp
      )
    : '—'

// Every admin action asks first: each one changes what the community sees.
const run = async (key, question, action, done) => {
  if (busyKey.value) return
  if ((await confirm({ cancelLabel: t('common.cancel'), ...question })) !== true) return
  busyKey.value = key
  try {
    await action()
    notifications.success(done)
  } catch {
    // useApi already reports the error.
  } finally {
    busyKey.value = null
  }
}

// `item` is a post, a food or one comment, with `target` and `key` naming the
// post or food and `commentId` the comment.
const kindOf = (item) => (item.commentId ? 'comment' : item.target)

const setHidden = (item, hidden) =>
  run(
    `${item.target}-${item.key}-${item.commentId ?? ''}`,
    hidden
      ? {
          title: t(`admin.remove-${kindOf(item)}`),
          message: t('admin.remove-description'),
          confirmLabel: t('admin.remove')
        }
      : {
          title: t(`admin.restore-${kindOf(item)}`),
          message: t('admin.restore-description'),
          confirmLabel: t('admin.restore')
        },
    () => adminSetHidden({ ...item, hidden }),
    hidden ? t('admin.removed-done') : t('admin.restored-done')
  )

const remove = (item) =>
  run(
    `${item.target}-${item.key}-${item.commentId ?? ''}`,
    {
      title: t(`admin.delete-${kindOf(item)}`),
      message: t(`admin.delete-${kindOf(item)}-description`),
      confirmLabel: t('common.delete'),
      variant: 'destructive'
    },
    () => {
      if (item.commentId) {
        return adminDeleteComment({
          target: item.target,
          parentKey: item.key,
          commentId: item.commentId
        })
      }
      return item.target === 'post'
        ? adminDeleteCommunityPost(item.key)
        : adminDeleteCommunityFood(item.key)
    },
    t('admin.deleted-done')
  )

// The threads inside the cards offer the same actions per comment.
provide(ADMIN_MODERATION, {
  busy: computed(() => busyKey.value !== null),
  setHidden: (target, key, commentId, hidden) => setHidden({ target, key, commentId }, hidden),
  remove: (target, key, commentId) => remove({ target, key, commentId })
})
const itemOf = (row) => ({ target: row.type, key: row.id })

const removeName = async (authorId) => {
  const answer = await confirm({
    title: t('admin.delete-name-title'),
    message: t('admin.delete-name-description'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    variant: 'destructive'
  })
  if (answer !== true) return
  try {
    await adminDeleteCommunityName(authorId)
  } catch {
    // useApi already reports the error.
  }
}

definePageMeta({ robots: false, sitemap: false })

useSeoMeta({ title: () => t('app.admin') })
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader :title="$t('app.admin')" />

    <p v-if="!store.authChecked || (store.user && store.isAdmin === null)" class="text-sm">
      {{ $t('admin.loading') }}
    </p>
    <p v-else-if="!store.isAdmin" class="text-sm text-gray-600 dark:text-gray-400">
      {{ $t('admin.only-admins') }}
    </p>

    <template v-else>
      <input
        v-model="search"
        type="search"
        :placeholder="$t('admin.search')"
        :aria-label="$t('admin.search-label')"
        class="mb-3 block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600"
      />

      <nav class="mb-3 flex flex-wrap gap-2" :aria-label="$t('admin.view-label')">
        <button
          v-for="option in [
            { key: 'all', label: $t('news.filter-all') },
            { key: 'hidden', label: $t('admin.view-removed', { count: hiddenCount }) }
          ]"
          :key="option.key"
          type="button"
          :aria-pressed="view === option.key"
          :class="[
            'cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors',
            view === option.key
              ? 'bg-sky-50 text-sky-700 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700'
              : 'text-gray-600 ring-gray-300 hover:text-sky-600 hover:ring-sky-400 dark:text-gray-400 dark:ring-gray-700 dark:hover:text-sky-400'
          ]"
          @click="view = option.key"
        >
          {{ option.label }}
        </button>
      </nav>

      <div
        v-if="filter"
        class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-sky-50 px-3 py-2 text-sm text-gray-800 dark:bg-sky-900/20 dark:text-gray-200"
      >
        <template v-if="filter">
          <i18n-t keypath="admin.everything-by" tag="span" scope="global">
            <template #name>
              <strong class="font-semibold">
                {{ nameOf(filter.userId) ?? $t('admin.this-user') }}
              </strong>
              <span class="font-mono text-xs text-gray-500 dark:text-gray-400">
                {{ filter.userId }}
              </span>
            </template>
          </i18n-t>
          <button
            v-if="nameOf(filter.userId)"
            type="button"
            class="cursor-pointer font-medium text-red-600 hover:underline dark:text-red-400"
            @click="removeName(filter.userId)"
          >
            {{ $t('admin.delete-name') }}
          </button>
        </template>
        <button
          type="button"
          class="ml-auto cursor-pointer font-medium text-sky-600 hover:underline dark:text-sky-400"
          @click="filter = null"
        >
          {{ $t('admin.show-everything') }}
        </button>
      </div>

      <p
        v-if="visibleRows.length === 0"
        class="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        {{ $t('admin.nothing-found') }}
      </p>

      <article
        v-for="row in visibleRows"
        :key="row.key"
        :class="[
          'mb-3 rounded-xl p-4 shadow-sm ring-1',
          row.hidden
            ? 'bg-gray-50 ring-gray-300 dark:bg-gray-900/60 dark:ring-gray-600'
            : 'bg-white ring-gray-200 dark:bg-gray-900 dark:ring-gray-700'
        ]"
      >
        <!-- The same header on every card: who, what they did, when, and in
             which language -->
        <div class="flex items-start">
          <span class="flex h-9 w-7 shrink-0 items-center justify-start text-lg">
            {{ emojiFor(row) }}
          </span>
          <div class="flex min-h-9 min-w-0 flex-1 items-start gap-2">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm leading-5 font-semibold break-words text-gray-900 dark:text-white">
                <button
                  type="button"
                  :class="[
                    'cursor-pointer text-left hover:underline',
                    isOfficial(row.authorId) ? 'text-sky-700 dark:text-sky-300' : ''
                  ]"
                  :title="$t('admin.show-user')"
                  @click="showUser(row.authorId)"
                >
                  {{ authorText(row) }}
                  <LucideBadgeCheck
                    v-if="isOfficial(row.authorId)"
                    class="mb-0.5 inline h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
                <span
                  v-if="row.hidden"
                  class="ml-1 inline-flex items-center gap-1 rounded bg-gray-200 px-1.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                >
                  <LucideEyeOff class="h-3 w-3" aria-hidden="true" />
                  {{ $t('admin.removed') }}
                </span>
              </h3>
              <p class="text-xs leading-4 break-words text-gray-500 dark:text-gray-400">
                <template v-if="row.type === 'food'">
                  <i18n-t keypath="admin.shared-food" tag="span" scope="global">
                    <template #name>
                      <strong class="font-semibold text-gray-700 dark:text-gray-300">
                        {{ row.text }}
                      </strong>
                    </template>
                  </i18n-t>
                  <span
                    v-if="row.hiddenByRatings"
                    class="ml-1 inline-flex items-center rounded bg-amber-50 px-1.5 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  >
                    {{ $t('admin.rated-down') }}
                  </span>
                </template>
                <template v-else>{{ $t('admin.wrote-post') }}</template>
                <span
                  v-if="row.hiddenCommentCount > 0"
                  class="ml-1 inline-flex items-center gap-1 rounded bg-gray-200 px-1.5 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                >
                  <LucideEyeOff class="h-3 w-3" aria-hidden="true" />
                  {{ $t('admin.removed-comments', { count: row.hiddenCommentCount }) }}
                </span>
              </p>
            </div>
            <div class="flex h-9 shrink-0 flex-col items-end justify-between">
              <time
                class="text-xs leading-4 text-gray-400 dark:text-gray-500"
                :datetime="row.at > 0 ? new Date(row.at).toISOString() : undefined"
              >
                {{ formatDate(row.at) }}
              </time>
              <span class="text-xs leading-4 whitespace-nowrap text-gray-400 dark:text-gray-500">
                {{ metaLabel(row) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Foods and posts: the News card with its votes or likes and its
             comments, opened in place, plus the admin's buttons in the same row -->
        <NewsCommunityFood
          v-if="row.type === 'food'"
          v-model:comments-expanded="expanded[row.key]"
          :food="row.food"
          :current-user-id="userId"
          :vote="voteOf(row.food)"
          :can-vote="row.food.contributorId !== userId"
          :show-statistics="row.food.contributorId === userId"
          :busy="votingKey === row.key"
          @vote="(value) => vote(row, value)"
        >
          <template #actions>
            <AdminRowActions
              :row="row"
              :busy="busyKey !== null"
              @hide="setHidden(itemOf(row), true)"
              @show="setHidden(itemOf(row), false)"
              @delete="remove(itemOf(row))"
            />
          </template>
        </NewsCommunityFood>
        <NewsCommunityPost
          v-else
          v-model:comments-expanded="expanded[row.key]"
          :post="row.post"
          :is-own="row.post.authorId === userId"
          :current-user-id="userId"
        >
          <template #actions>
            <AdminRowActions
              :row="row"
              :busy="busyKey !== null"
              @hide="setHidden(itemOf(row), true)"
              @show="setHidden(itemOf(row), false)"
              @delete="remove(itemOf(row))"
            />
          </template>
        </NewsCommunityPost>
      </article>

      <button
        v-if="hasMore"
        type="button"
        class="mb-3 w-full cursor-pointer rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-sky-400 hover:text-sky-600 dark:border-gray-700 dark:text-gray-400 dark:hover:text-sky-400"
        @click="visibleCount += PAGE_SIZE"
      >
        {{ $t('news.load-more') }}
      </button>
    </template>
  </div>
</template>
