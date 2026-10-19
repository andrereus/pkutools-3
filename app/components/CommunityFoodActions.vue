<script setup>
import { hasContentUpdate } from '../utils/news-grouping'

// The row under a community food and its comment thread, the same in News,
// Food Search and Own Food: votes, or the figures for the contributor, on the
// left; comments and editing on the right. Comments open in place.
const props = defineProps({
  food: { type: Object, required: true },
  /** Signed-in reader; nothing is shown without an account. */
  currentUserId: { type: String, default: null },
  /** This reader's vote on the food: 1, -1 or null. */
  vote: { type: Number, default: null },
  /** Vote buttons rather than figures. The contributor gets the figures. */
  canVote: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  /** Where the contributor edits the food. */
  editTo: { type: String, default: null }
})

// `edit` fires as the edit link is followed, so a dialog can close first.
const emit = defineEmits(['vote', 'edit'])
const commentsExpanded = defineModel('commentsExpanded', { type: Boolean, default: false })
const { t } = useI18n()

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

const countOf = (value) => {
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}
const likes = computed(() => countOf(props.food.likes))
const dislikes = computed(() => countOf(props.food.dislikes))
const commentCount = computed(() => countOf(props.food.commentCount))
const visibleCommentCount = computed(() => (commentCount.value > 99 ? '99+' : commentCount.value))
const hasHistory = computed(() => hasContentUpdate(props.food))
const commentButtonLabel = computed(() =>
  commentCount.value > 0
    ? t('news.comments-count', { count: commentCount.value })
    : hasHistory.value
      ? t('news.comments-history')
      : t('news.add-comment')
)
</script>

<template>
  <div v-if="currentUserId && food['.key']">
    <ActionBar>
      <template #start>
        <template v-if="canVote">
          <ActionChip
            tone="teal"
            :active="vote === 1"
            :disabled="busy"
            :aria-pressed="vote === 1"
            :aria-label="`${$t('news.looks-right')}: ${likes}`"
            :title="$t('news.looks-right')"
            @click="emit('vote', 1)"
          >
            <LucideCheck v-if="justVoted && vote === 1" class="h-4 w-4" aria-hidden="true" />
            <LucideThumbsUp v-else class="h-4 w-4" aria-hidden="true" />
            <span>{{ likes }}</span>
          </ActionChip>
          <ActionChip
            tone="red"
            :active="vote === -1"
            :disabled="busy"
            :aria-pressed="vote === -1"
            :aria-label="`${$t('news.looks-off')}: ${dislikes}`"
            :title="$t('news.looks-off')"
            @click="emit('vote', -1)"
          >
            <LucideCheck v-if="justVoted && vote === -1" class="h-4 w-4" aria-hidden="true" />
            <LucideThumbsDown v-else class="h-4 w-4" aria-hidden="true" />
            <span>{{ dislikes }}</span>
          </ActionChip>
          <span class="sr-only" aria-live="polite">
            {{ justVoted ? $t('news.vote-saved') : '' }}
          </span>
        </template>

        <!-- Zero ratings are useful information too, including on a food
             that has comments but no votes. -->
        <template v-else>
          <ActionChip tone="teal" readonly accent>
            <LucideThumbsUp class="h-4 w-4" aria-hidden="true" />
            <span>{{ likes }}</span>
            <span class="sr-only">{{ $t('community.like') }}</span>
          </ActionChip>
          <ActionChip tone="red" readonly accent>
            <LucideThumbsDown class="h-4 w-4" aria-hidden="true" />
            <span>{{ dislikes }}</span>
            <span class="sr-only">{{ $t('community.dislike') }}</span>
          </ActionChip>
        </template>
      </template>

      <template #end>
        <!-- Accented while collapsed, so an existing conversation is visible
             before the thread is opened. -->
        <ActionChip
          tone="sky"
          :active="commentsExpanded"
          :accent="commentCount > 0 || hasHistory"
          :aria-label="commentButtonLabel"
          :title="commentButtonLabel"
          :aria-expanded="commentsExpanded"
          :aria-controls="`community-comments-${food['.key']}`"
          @click="commentsExpanded = !commentsExpanded"
        >
          <LucideMessageCircle class="h-4 w-4" aria-hidden="true" />
          <span v-if="commentCount > 0">{{ visibleCommentCount }}</span>
        </ActionChip>
        <ActionChip
          v-if="!canVote && editTo"
          :to="editTo"
          square
          :aria-label="$t('common.edit')"
          :title="$t('common.edit')"
          @click="emit('edit')"
        >
          <LucidePencil class="h-4 w-4" aria-hidden="true" />
        </ActionChip>
      </template>
    </ActionBar>

    <!-- Context for the thread, such as hints for the contributor. -->
    <slot />

    <CommunityFoodComments
      :key="food['.key']"
      :food-key="food['.key']"
      :contributor-id="food.contributorId"
      :current-user-id="currentUserId"
      :expanded="commentsExpanded"
    />
  </div>
</template>
