<script setup>
import { getDatabase, onValue, ref as databaseRef } from 'firebase/database'
import { COMMUNITY_POSTS_LIMIT, useStore } from '../../stores/index'
import { communityFoodScore, isCommunityFoodHidden } from '../utils/community-food'
import { REMOVED_CONTENT_RETENTION_MS } from '#shared/utils/moderation'

// Moderation: everything the community publishes, in all languages, newest
// first, in cards built like the ones in News, with their votes, likes and
// comments. Removing keeps the content restorable for a while under Removed.
// Admin-only; the page's own wording is English. Every action is checked
// server-side.

const store = useStore()
const {
  voteCommunityFood,
  adminDeleteCommunityPost,
  adminDeleteCommunityFood,
  adminDeleteComment,
  adminDeleteCommunityName,
  adminRestoreRemoved,
  adminDeleteRemoved,
  adminPurgeRemoved
} = useApi()
const { confirm } = useConfirm()
const notifications = useNotifications()
const { nameOf, isOfficial } = useCommunityAuthor()
const { locale } = useI18n()

const PAGE_SIZE = 50
const RETENTION_DAYS = Math.round(REMOVED_CONTENT_RETENTION_MS / (24 * 60 * 60 * 1000))
// 'live' for what the community sees, 'removed' for what can be restored.
const view = ref('live')
const search = ref('')
// Null for everything, { kind: 'user', userId } for one account's content, or
// { kind: 'thread', target, parentKey } for a post or food with its comments.
const filter = ref(null)
const visibleCount = ref(PAGE_SIZE)
const busyKey = ref(null)
const votingKey = ref(null)
// Which cards have their comments open, as in News.
const expanded = ref({})
const userId = computed(() => store.user?.id ?? null)

watch([view, search, filter], () => {
  visibleCount.value = PAGE_SIZE
})
// Threads exist only in the live view; a user filter carries over.
watch(view, () => {
  if (filter.value?.kind === 'thread') filter.value = null
})

// Comment threads and removed content are read only here, and only once
// admin rights are known. Opening the page also clears out expired removals.
const foodComments = ref({})
const postComments = ref({})
const removedEntries = ref({})
const unsubscribes = []

watch(
  () => store.isAdmin,
  (admin) => {
    if (!admin || !import.meta.client || unsubscribes.length > 0) return
    for (const [path, target] of [
      ['communityFoodComments', foodComments],
      ['communityPostComments', postComments],
      ['removedContent', removedEntries]
    ]) {
      unsubscribes.push(
        onValue(databaseRef(getDatabase(), path), (snapshot) => {
          target.value = snapshot.val() ?? {}
        })
      )
    }
    adminPurgeRemoved().catch(() => {})
  },
  { immediate: true }
)

onUnmounted(() => unsubscribes.forEach((unsubscribe) => unsubscribe()))

const latest = (...values) =>
  Math.max(0, ...values.filter((value) => Number.isSafeInteger(value) && value > 0))
const isEdited = (createdAt, updatedAt) => latest(updatedAt) > latest(createdAt)
const excerpt = (text) =>
  typeof text === 'string' && text.length > 50 ? `${text.slice(0, 50)}…` : (text ?? '')
const countOf = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0)

const foodsByKey = computed(() =>
  Object.fromEntries(store.communityFoods.map((food) => [food['.key'], food]))
)
const postsByKey = computed(() =>
  Object.fromEntries(store.communityPosts.map((post) => [post['.key'], post]))
)
// Comments can belong to a post older than the ones the app loads.
const threadTitle = (target, parentKey) => {
  const parent = (target === 'food' ? foodsByKey.value : postsByKey.value)[parentKey]
  if (!parent) return `older ${target}`
  return target === 'food' ? `food “${parent.name}”` : `post “${excerpt(parent.text)}”`
}

const rows = computed(() => {
  const list = []

  for (const post of store.communityPosts) {
    list.push({
      key: `post-${post['.key']}`,
      type: 'post',
      id: post['.key'],
      authorId: post.authorId,
      language: post.language,
      createdAt: latest(post.createdAt),
      at: latest(post.createdAt, post.updatedAt),
      edited: isEdited(post.createdAt, post.updatedAt),
      text: post.text,
      post
    })
  }

  for (const food of store.communityFoods) {
    list.push({
      key: `food-${food['.key']}`,
      type: 'food',
      id: food['.key'],
      authorId: food.contributorId,
      language: food.language,
      createdAt: latest(food.createdAt),
      at: latest(food.createdAt, food.contentUpdatedAt),
      edited: isEdited(food.createdAt, food.contentUpdatedAt),
      text: food.name,
      note: food.note,
      food,
      hidden: isCommunityFoodHidden(communityFoodScore(food))
    })
  }

  for (const [target, threads] of [
    ['food', foodComments.value],
    ['post', postComments.value]
  ]) {
    const parents = target === 'food' ? foodsByKey.value : postsByKey.value
    for (const [parentKey, thread] of Object.entries(threads)) {
      for (const [commentId, comment] of Object.entries(thread ?? {})) {
        // Edit history is part of the food, not something anyone wrote.
        if (!comment || comment.type === 'content-update' || typeof comment.text !== 'string') {
          continue
        }
        list.push({
          key: `comment-${target}-${parentKey}-${commentId}`,
          type: 'comment',
          target,
          parentKey,
          id: commentId,
          authorId: comment.authorId,
          language: parents[parentKey]?.language,
          createdAt: latest(comment.createdAt),
          at: latest(comment.createdAt, comment.updatedAt),
          edited: isEdited(comment.createdAt, comment.updatedAt),
          text: comment.text
        })
      }
    }
  }

  return list.sort((left, right) => right.at - left.at)
})

// Removed content, newest removal first, in the same shape as the live rows.
const removedRows = computed(() =>
  Object.entries(removedEntries.value)
    .flatMap(([removedId, entry]) => {
      const record = entry?.record
      if (!record || typeof record !== 'object') return []
      const base = {
        key: `removed-${removedId}`,
        removedId,
        type: entry.type,
        id: entry.key,
        authorId: entry.authorId,
        language: entry.language,
        createdAt: latest(record.createdAt),
        at: latest(entry.removedAt)
      }
      if (entry.type === 'post') {
        return [{ ...base, text: record.text, likes: countOf(record.likes) }]
      }
      if (entry.type === 'food') {
        return [
          {
            ...base,
            text: record.name,
            note: record.note,
            food: { ...record, '.key': entry.key },
            hidden: isCommunityFoodHidden(communityFoodScore(record))
          }
        ]
      }
      if (entry.type === 'comment') {
        return [
          {
            ...base,
            target: entry.target,
            parentKey: entry.parentKey,
            parentTitle: entry.parentTitle,
            text: record.text
          }
        ]
      }
      return []
    })
    .sort((left, right) => right.at - left.at)
)

const inFilter = (row) => {
  const current = filter.value
  if (!current) return true
  if (current.kind === 'user') return row.authorId === current.userId
  if (row.type === 'comment') {
    return row.target === current.target && row.parentKey === current.parentKey
  }
  return row.type === current.target && row.id === current.parentKey
}

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  const source = view.value === 'removed' ? removedRows.value : rows.value
  const list = source.filter(
    (row) =>
      inFilter(row) &&
      (!query ||
        [row.text, row.note, row.authorId, nameOf(row.authorId)].some(
          (field) => typeof field === 'string' && field.toLowerCase().includes(query)
        ))
  )
  // A thread reads as a conversation: the post or food first, then its comments in order.
  if (filter.value?.kind === 'thread') {
    return [...list].sort(
      (left, right) =>
        Number(left.type === 'comment') - Number(right.type === 'comment') ||
        left.createdAt - right.createdAt
    )
  }
  return list
})
const visibleRows = computed(() => filteredRows.value.slice(0, visibleCount.value))

const showUser = (authorId) => {
  if (typeof authorId === 'string' && authorId) filter.value = { kind: 'user', userId: authorId }
}
// Opened from a comment card: its post or food with every comment as a card,
// each with its own remove button.
const showThread = (target, parentKey) => {
  filter.value = { kind: 'thread', target, parentKey }
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

const EMOJI = { post: '💬', comment: '💭' }
const emojiFor = (row) => (row.type === 'food' ? row.food.emoji || '🌱' : EMOJI[row.type])

const authorText = (row) => {
  if (isOfficial(row.authorId)) return 'PKU Tools'
  if (typeof row.authorId !== 'string') return 'Unknown user'
  const shortId = row.authorId.slice(0, 8)
  const name = nameOf(row.authorId)
  return name ? `${name} (${shortId})` : `User ${shortId}`
}

// A link that opens the card's text in Google Translate, for content in a
// language other than the admin's own app language.
const translateUrl = (row) => {
  const source = row.language
  if (!source || source === locale.value) return null
  const text = [row.text, row.note]
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .join('\n\n')
  if (!text) return null
  return (
    `https://translate.google.com/?sl=${encodeURIComponent(source)}` +
    `&tl=${encodeURIComponent(locale.value)}&text=${encodeURIComponent(text)}&op=translate`
  )
}

// Where a removed comment was written, as recorded when it was removed.
const removedContext = (row) =>
  row.parentTitle ? `the ${row.target} “${row.parentTitle}”` : `a ${row.target}`

// What kind of content it is is in the action line under the author.
const metaLabel = (row) =>
  [
    (row.language ?? '—').toUpperCase(),
    row.edited ? 'edited' : null,
    row.removedId ? 'removed' : null
  ]
    .filter(Boolean)
    .join(' · ')

const formatDate = (timestamp) =>
  timestamp > 0
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
        timestamp
      )
    : '—'

// Every admin action asks first, the restorable ones included: each one
// changes what the community sees.
const REMOVAL_MESSAGES = {
  post: 'The post and its comments disappear for everyone.',
  food: 'The food and its comments leave the community, and the contributor’s own food is unshared.',
  comment: 'The comment disappears for everyone.'
}

const remove = async (row) => {
  if (busyKey.value) return
  const answer = await confirm({
    title: `Remove ${row.type}?`,
    message: `${REMOVAL_MESSAGES[row.type]} It can be restored for ${RETENTION_DAYS} days under Removed.`,
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
    variant: 'destructive'
  })
  if (answer !== true) return
  busyKey.value = row.key
  try {
    if (row.type === 'post') await adminDeleteCommunityPost(row.id)
    else if (row.type === 'food') await adminDeleteCommunityFood(row.id)
    else
      await adminDeleteComment({ target: row.target, parentKey: row.parentKey, commentId: row.id })
    notifications.success('Removed.')
  } catch {
    // useApi already reports the error.
  } finally {
    busyKey.value = null
  }
}

const RESTORE_MESSAGES = {
  post: 'The post and its comments become visible again.',
  food: 'The food and its comments return to the community, and the contributor’s own food is shared again.',
  comment: 'The comment returns to its thread.'
}

const restore = async (row) => {
  if (busyKey.value) return
  const answer = await confirm({
    title: `Restore ${row.type}?`,
    message: RESTORE_MESSAGES[row.type],
    confirmLabel: 'Restore',
    cancelLabel: 'Cancel'
  })
  if (answer !== true) return
  busyKey.value = row.key
  try {
    await adminRestoreRemoved(row.removedId)
    notifications.success('Restored.')
  } catch {
    // useApi already reports the error, including why it could not be restored.
  } finally {
    busyKey.value = null
  }
}

const deletePermanently = async (row) => {
  if (busyKey.value) return
  const answer = await confirm({
    title: `Delete ${row.type} permanently?`,
    message:
      row.type === 'comment'
        ? 'The comment can no longer be restored.'
        : `The ${row.type} and its comments can no longer be restored.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    variant: 'destructive'
  })
  if (answer !== true) return
  busyKey.value = row.key
  try {
    await adminDeleteRemoved(row.removedId)
  } catch {
    // useApi already reports the error.
  } finally {
    busyKey.value = null
  }
}

const removeName = async (userId) => {
  const answer = await confirm({
    title: 'Remove community name?',
    message: 'Their posts and comments then show as “Community member”. They can set a new name.',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
    variant: 'destructive'
  })
  if (answer !== true) return
  try {
    await adminDeleteCommunityName(userId)
  } catch {
    // useApi already reports the error.
  }
}

definePageMeta({ robots: false, sitemap: false })

useSeoMeta({ title: 'Admin' })
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader title="Admin" />

    <p v-if="!store.authChecked || (store.user && store.isAdmin === null)" class="text-sm">
      Loading…
    </p>
    <p v-else-if="!store.isAdmin" class="text-sm text-gray-600 dark:text-gray-400">
      This page is only available to admins.
    </p>

    <template v-else>
      <input
        v-model="search"
        type="search"
        placeholder="Search text, name or user ID"
        aria-label="Search"
        class="mb-3 block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600"
      />

      <nav class="mb-3 flex flex-wrap gap-2" aria-label="View">
        <button
          v-for="option in [
            { key: 'live', label: 'Live' },
            { key: 'removed', label: `Removed (${removedRows.length})` }
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
        <template v-if="filter.kind === 'user'">
          <span>
            Everything by
            <strong class="font-semibold">
              {{ nameOf(filter.userId) ?? 'this user' }}
            </strong>
            <span class="font-mono text-xs text-gray-500 dark:text-gray-400">
              {{ filter.userId }}
            </span>
          </span>
          <button
            v-if="nameOf(filter.userId)"
            type="button"
            class="cursor-pointer font-medium text-red-600 hover:underline dark:text-red-400"
            @click="removeName(filter.userId)"
          >
            Remove name
          </button>
        </template>
        <span v-else>
          The {{ threadTitle(filter.target, filter.parentKey) }} and its comments
        </span>
        <button
          type="button"
          class="ml-auto cursor-pointer font-medium text-sky-600 hover:underline dark:text-sky-400"
          @click="filter = null"
        >
          Show everything
        </button>
      </div>

      <p
        v-if="view === 'live' && store.communityPosts.length >= COMMUNITY_POSTS_LIMIT"
        class="mb-3 text-xs text-gray-500 dark:text-gray-400"
      >
        Only the newest {{ COMMUNITY_POSTS_LIMIT }} posts are listed, which is what the app loads.
      </p>
      <p v-if="view === 'removed'" class="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Removed content can be restored for {{ RETENTION_DAYS }} days, then it is deleted.
      </p>

      <p
        v-if="visibleRows.length === 0"
        class="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        Nothing found.
      </p>

      <article
        v-for="row in visibleRows"
        :key="row.key"
        class="mb-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
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
                  title="Show everything by this user"
                  @click="showUser(row.authorId)"
                >
                  {{ authorText(row) }}
                  <LucideBadgeCheck
                    v-if="isOfficial(row.authorId)"
                    class="mb-0.5 inline h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <p class="text-xs leading-4 break-words text-gray-500 dark:text-gray-400">
                <template v-if="row.type === 'food'">
                  shared the food
                  <strong class="font-semibold text-gray-700 dark:text-gray-300">
                    {{ row.text }}
                  </strong>
                  <span
                    v-if="row.hidden"
                    class="ml-1 inline-flex items-center rounded bg-amber-50 px-1.5 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  >
                    Hidden
                  </span>
                </template>
                <template v-else-if="row.type === 'post'">wrote a post</template>
                <template v-else-if="row.removedId"
                  >commented on {{ removedContext(row) }}</template
                >
                <button
                  v-else
                  type="button"
                  class="cursor-pointer text-left hover:text-sky-600 hover:underline dark:hover:text-sky-400"
                  title="Show this thread"
                  @click="showThread(row.target, row.parentKey)"
                >
                  commented on the {{ threadTitle(row.target, row.parentKey) }}
                </button>
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

        <!-- Live foods and posts: the News card with its votes or likes and its
             comments, opened in place, plus the admin's buttons in the same row -->
        <NewsCommunityFood
          v-if="row.type === 'food' && !row.removedId"
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
              :translate-url="translateUrl(row)"
              :busy="busyKey !== null"
              :retention-days="RETENTION_DAYS"
              @remove="remove(row)"
            />
          </template>
        </NewsCommunityFood>
        <NewsCommunityPost
          v-else-if="row.type === 'post' && !row.removedId"
          v-model:comments-expanded="expanded[row.key]"
          :post="row.post"
          :is-own="row.post.authorId === userId"
          :current-user-id="userId"
        >
          <template #actions>
            <AdminRowActions
              :row="row"
              :translate-url="translateUrl(row)"
              :busy="busyKey !== null"
              :retention-days="RETENTION_DAYS"
              @remove="remove(row)"
            />
          </template>
        </NewsCommunityPost>

        <!-- A comment has no figures, so its buttons sit beside the text
             rather than in a row of their own. -->
        <div v-else-if="row.type === 'comment'" class="mt-2 flex items-start gap-3">
          <p
            class="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
          >
            {{ row.text }}
          </p>
          <AdminRowActions
            :row="row"
            :translate-url="translateUrl(row)"
            :busy="busyKey !== null"
            :retention-days="RETENTION_DAYS"
            @remove="remove(row)"
            @restore="restore(row)"
            @delete="deletePermanently(row)"
          />
        </div>

        <!-- Removed foods and posts: their content and figures as they were -->
        <template v-else>
          <NewsCommunityFood v-if="row.type === 'food'" :food="row.food" />
          <p
            v-else
            class="mt-2 text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
          >
            {{ row.text }}
          </p>

          <ActionBar>
            <template #start>
              <template v-if="row.type === 'food'">
                <ActionChip tone="teal" readonly accent>
                  <LucideThumbsUp class="h-4 w-4" aria-hidden="true" />
                  <span>{{ countOf(row.food.likes) }}</span>
                  <span class="sr-only">likes</span>
                </ActionChip>
                <ActionChip tone="red" readonly accent>
                  <LucideThumbsDown class="h-4 w-4" aria-hidden="true" />
                  <span>{{ countOf(row.food.dislikes) }}</span>
                  <span class="sr-only">dislikes</span>
                </ActionChip>
              </template>
              <ActionChip v-else tone="rose" readonly :accent="row.likes > 0">
                <LucideHeart class="h-4 w-4" aria-hidden="true" />
                <span>{{ row.likes }}</span>
                <span class="sr-only">likes</span>
              </ActionChip>
            </template>
            <template #end>
              <AdminRowActions
                :row="row"
                :translate-url="translateUrl(row)"
                :busy="busyKey !== null"
                :retention-days="RETENTION_DAYS"
                @restore="restore(row)"
                @delete="deletePermanently(row)"
              />
            </template>
          </ActionBar>
        </template>
      </article>

      <button
        v-if="visibleRows.length < filteredRows.length"
        type="button"
        class="mb-3 w-full cursor-pointer rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-sky-400 hover:text-sky-600 dark:border-gray-700 dark:text-gray-400 dark:hover:text-sky-400"
        @click="visibleCount += PAGE_SIZE"
      >
        Show more
      </button>
    </template>
  </div>
</template>
