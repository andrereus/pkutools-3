<script setup>
import { foodSourceLabel } from '../utils/food-source-label'
import { nutrientRows, PHE_FACTORS } from '../utils/nutrition'
import { COMMUNITY_FOOD_FLAG_SCORE, communityFoodScore } from '../utils/community-food'

// Renders a community-food record inside a News card.
const props = defineProps({
  food: { type: Object, required: true },
  /** This user's existing vote on the food: 1, -1, or null. */
  vote: { type: Number, default: null },
  /** Whether vote controls are available to this reader. */
  canVote: { type: Boolean, default: false },
  /** Only the contributor sees the aggregate activity on their shared food. */
  showStatistics: { type: Boolean, default: false },
  /** Signed-in reader; community comments remain unavailable without an account. */
  currentUserId: { type: String, default: null },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['vote'])
const { t } = useI18n()
const localePath = useLocalePath()
const showNutrients = ref(false)
const commentsExpanded = defineModel('commentsExpanded', { type: Boolean, default: false })

// Brief visual confirmation without changing the control dimensions.
const justVoted = ref(false)
let thanksTimer = null

watch(
  () => props.vote,
  (value) => {
    clearTimeout(thanksTimer)
    justVoted.value = value !== null && value !== undefined
    if (justVoted.value) {
      thanksTimer = setTimeout(() => {
        justVoted.value = false
      }, 2600)
    }
  }
)

onUnmounted(() => clearTimeout(thanksTimer))

// Per 100 g, which is the reference the stored values are already in.
const rows = computed(() => nutrientRows(props.food?.nutrients, 100, t))

const sourceLabel = computed(() => (props.food ? foodSourceLabel(props.food, t) : null))
const factorTypeLabel = computed(() => {
  const type = Object.entries(PHE_FACTORS).find(
    ([, factor]) => factor === Number(props.food?.factor)
  )?.[0]
  return type ? t(`news.factor-${type}`) : null
})
const sourceDetails = computed(() =>
  [sourceLabel.value, factorTypeLabel.value].filter(Boolean).join(' · ')
)
const commentCount = computed(() => {
  const value = Number(props.food?.commentCount)
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
})
const commentButtonLabel = computed(() =>
  commentCount.value > 0
    ? t('news.comments-count', { count: commentCount.value })
    : t('news.add-comment')
)
const visibleCommentCount = computed(() => (commentCount.value > 99 ? '99+' : commentCount.value))
const showCorrectionHint = computed(
  () =>
    !!props.currentUserId &&
    props.food.contributorId === props.currentUserId &&
    communityFoodScore(props.food) <= COMMUNITY_FOOD_FLAG_SCORE
)
</script>

<template>
  <div class="mt-2">
    <div class="grid grid-cols-2 items-center gap-x-4">
      <span class="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
        {{ food.phe }} mg Phe
      </span>
      <span class="flex min-w-0 items-center justify-between gap-1">
        <span class="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
          {{ food.kcal }} {{ $t('common.kcal') }}
        </span>
        <button
          v-if="rows.length > 0"
          type="button"
          class="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          :aria-expanded="showNutrients"
          :aria-label="$t(showNutrients ? 'news.hide-nutrients' : 'news.show-nutrients')"
          @click="showNutrients = !showNutrients"
        >
          <span aria-hidden="true">{{ $t('news.more') }}</span>
          <LucideChevronDown
            class="h-4 w-4 transition-transform"
            :class="showNutrients ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
      </span>
    </div>

    <div
      v-if="showNutrients && rows.length > 0"
      class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:gap-x-6 sm:text-sm dark:text-gray-400"
    >
      <div v-for="row in rows" :key="row.key" class="flex justify-between gap-2">
        <span class="min-w-0">{{ row.label }}</span>
        <span class="shrink-0 whitespace-nowrap">{{ row.value }} g</span>
      </div>
    </div>

    <p v-if="sourceDetails" class="mt-2 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
      {{ sourceDetails }}
    </p>

    <div
      v-if="food.note"
      class="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-gray-700 dark:bg-sky-900/20 dark:text-gray-300"
    >
      {{ food.note }}
    </div>

    <!-- Keep contributor statistics and comments accessible even before the
         first rating, or if a stale comment count temporarily reads zero. -->
    <div
      v-if="currentUserId && food['.key'] && (canVote || showStatistics)"
      class="mt-3 flex items-center gap-2"
    >
      <template v-if="canVote">
        <button
          type="button"
          :disabled="busy"
          :aria-pressed="vote === 1"
          :aria-label="$t('news.looks-right')"
          :class="[
            'flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-center text-sm font-semibold ring-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 sm:gap-2 sm:px-3',
            vote === 1
              ? 'bg-teal-50 text-teal-700 ring-teal-400 dark:bg-teal-900/40 dark:text-teal-300 dark:ring-teal-700'
              : 'text-gray-700 ring-gray-300 hover:text-teal-600 hover:ring-teal-400 dark:text-gray-300 dark:ring-gray-600 dark:hover:text-teal-400'
          ]"
          @click="emit('vote', 1)"
        >
          <LucideCheck v-if="justVoted && vote === 1" class="h-4 w-4 shrink-0" />
          <LucideThumbsUp v-else class="h-4 w-4 shrink-0" />
          <span class="truncate">{{ $t('news.looks-right') }}</span>
        </button>
        <button
          type="button"
          :disabled="busy"
          :aria-pressed="vote === -1"
          :aria-label="$t('news.looks-off')"
          :class="[
            'flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-center text-sm font-semibold ring-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 sm:gap-2 sm:px-3',
            vote === -1
              ? 'bg-red-50 text-red-700 ring-red-400 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-700'
              : 'text-gray-700 ring-gray-300 hover:text-red-600 hover:ring-red-400 dark:text-gray-300 dark:ring-gray-600 dark:hover:text-red-400'
          ]"
          @click="emit('vote', -1)"
        >
          <LucideCheck v-if="justVoted && vote === -1" class="h-4 w-4 shrink-0" />
          <LucideThumbsDown v-else class="h-4 w-4 shrink-0" />
          <span class="truncate">{{ $t('news.looks-off') }}</span>
        </button>

        <span class="sr-only" aria-live="polite">
          {{ justVoted ? $t('news.vote-saved') : '' }}
        </span>
      </template>

      <template v-else-if="showStatistics">
        <!-- Zero ratings are useful information too, including on a food
             that has comments but no votes. -->
        <div
          class="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
        >
          <div
            class="inline-flex items-center gap-2.5 overflow-hidden rounded-lg bg-white px-2.5 ring-1 ring-gray-300 dark:bg-gray-900 dark:ring-gray-600"
          >
            <span
              class="flex min-h-8 items-center bg-white text-gray-900 dark:bg-gray-900 dark:text-white"
            >
              {{ $t('community.statistics') }}
            </span>
            <span
              class="flex min-h-8 items-center gap-1 bg-white text-teal-700 dark:bg-gray-900 dark:text-teal-300"
            >
              <LucideThumbsUp class="h-4 w-4" aria-hidden="true" />
              <span>{{ food.likes || 0 }}</span>
              <span class="sr-only">{{ $t('community.like') }}</span>
            </span>
            <span
              class="flex min-h-8 items-center gap-1 bg-white text-red-700 dark:bg-gray-900 dark:text-red-300"
            >
              <LucideThumbsDown class="h-4 w-4" aria-hidden="true" />
              <span>{{ food.dislikes || 0 }}</span>
              <span class="sr-only">{{ $t('community.dislike') }}</span>
            </span>
          </div>
        </div>
      </template>

      <button
        type="button"
        class="ml-auto flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-normal ring-1 transition-colors hover:bg-sky-50 hover:text-sky-700 hover:ring-sky-400 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-sky-900/40 dark:hover:text-sky-300 dark:hover:ring-sky-600"
        :class="[
          canVote ? 'h-9' : 'min-h-8',
          commentsExpanded
            ? 'bg-sky-50 text-sky-700 ring-sky-400 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-700'
            : 'bg-white text-gray-900 ring-gray-300 dark:bg-gray-900 dark:text-white dark:ring-gray-600'
        ]"
        :aria-label="commentButtonLabel"
        :title="commentButtonLabel"
        :aria-expanded="commentsExpanded"
        :aria-controls="`community-comments-${food['.key']}`"
        @click="commentsExpanded = !commentsExpanded"
      >
        <LucideMessageCircle class="h-4 w-4" aria-hidden="true" />
        <span v-if="commentCount > 0">{{ visibleCommentCount }}</span>
      </button>
    </div>

    <i18n-t
      v-if="showCorrectionHint"
      keypath="news.food-correction-hint"
      tag="p"
      scope="global"
      class="mt-3 text-xs text-gray-500 sm:text-sm dark:text-gray-400"
    >
      <template #ownFood>
        <NuxtLink
          :to="localePath('own-food')"
          class="text-sky-600 hover:underline dark:text-sky-400"
        >
          {{ $t('own-food.title') }}
        </NuxtLink>
      </template>
    </i18n-t>

    <CommunityFoodComments
      v-if="currentUserId && food['.key']"
      :food-key="food['.key']"
      :contributor-id="food.contributorId"
      :current-user-id="currentUserId"
      :expanded="commentsExpanded"
    />
  </div>
</template>
