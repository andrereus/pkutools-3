<script setup>
import { foodDetailRows } from '../utils/food-details'
import { COMMUNITY_FOOD_FLAG_SCORE, communityFoodScore } from '../utils/community-food'

// Renders a community-food record inside a News card. Without a signed-in
// reader it shows the values only, as on the admin page.
const props = defineProps({
  food: { type: Object, required: true },
  /** This user's existing vote on the food: 1, -1, or null. */
  vote: { type: Number, default: null },
  /** Whether vote controls are available to this reader. */
  canVote: { type: Boolean, default: false },
  /** The contributor, who sees the figures and can edit the food. */
  showStatistics: { type: Boolean, default: false },
  /** Whether this contributor has a pending comment notice for the food. */
  hasPendingFeedback: { type: Boolean, default: false },
  /** Signed-in reader; community comments remain unavailable without an account. */
  currentUserId: { type: String, default: null },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['vote'])
const { t } = useI18n()
const localePath = useLocalePath()
const editFoodPath = computed(() =>
  props.showStatistics &&
  props.currentUserId &&
  props.food.contributorId === props.currentUserId &&
  props.food.ownFoodKey
    ? `${localePath('own-food')}?edit=${encodeURIComponent(props.food.ownFoodKey)}`
    : null
)
const showDetails = ref(false)
const commentsExpanded = defineModel('commentsExpanded', { type: Boolean, default: false })

// The card shows Phe, kcal and the note; everything else is under More, per
// 100 g, which is the reference the stored values are already in.
const hasDetails = computed(() => {
  const rows = foodDetailRows(props.food, 100, t)
  return rows.nutrients.length > 0 || rows.details.length > 0
})
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
          v-if="hasDetails"
          type="button"
          class="-my-1 inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md py-1 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-300 dark:hover:text-white"
          :aria-expanded="showDetails"
          :aria-label="$t(showDetails ? 'news.hide-details' : 'news.show-details')"
          @click="showDetails = !showDetails"
        >
          <span aria-hidden="true">{{ $t('news.more') }}</span>
          <LucideChevronDown
            class="h-4 w-4 transition-transform"
            :class="showDetails ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
      </span>
    </div>

    <FoodDetails v-if="showDetails" class="mt-2" :food="food" />

    <FoodNote v-if="food.note" class="mt-3" :note="food.note" />

    <!-- Keep contributor statistics and comments accessible even before the
         first rating, or if a stale comment count temporarily reads zero. -->
    <CommunityFoodActions
      v-model:comments-expanded="commentsExpanded"
      :food="food"
      :current-user-id="currentUserId"
      :vote="vote"
      :can-vote="canVote"
      :busy="busy"
      :edit-to="editFoodPath"
      @vote="(value) => emit('vote', value)"
    >
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

      <i18n-t
        v-if="hasPendingFeedback"
        keypath="news.comment-notice-hint"
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
    </CommunityFoodActions>
  </div>
</template>
