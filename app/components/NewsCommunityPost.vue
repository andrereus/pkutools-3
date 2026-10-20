<script setup>
// Renders a community post inside a News card: its text, likes and comments.
// The author edits it like a comment, with Delete inside the editor.
const MAX_LENGTH = 1000

const props = defineProps({
  post: { type: Object, required: true },
  /** Written by the current reader, who can edit it but not like it. */
  isOwn: { type: Boolean, default: false },
  currentUserId: { type: String, default: null }
})

const { t } = useI18n()
const { likeCommunityPost, saveCommunityPost, deleteCommunityPost } = useApi()
const { confirm } = useConfirm()
const commentsExpanded = defineModel('commentsExpanded', { type: Boolean, default: false })

const liking = ref(false)
const editing = ref(false)
const editDraft = ref('')
const savingEdit = ref(false)
const deleting = ref(false)
const statusMessage = ref('')

const countOf = (value) => {
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}
const likeCount = computed(() => countOf(props.post.likes))
const commentCount = computed(() => countOf(props.post.commentCount))
const visibleCommentCount = computed(() => (commentCount.value > 99 ? '99+' : commentCount.value))
const liked = computed(
  () => !!props.currentUserId && props.post.likerIds?.[props.currentUserId] === true
)
const commentButtonLabel = computed(() =>
  commentCount.value > 0
    ? t('news.comments-count', { count: commentCount.value })
    : t('news.add-comment')
)
const trimmedEditDraft = computed(() => editDraft.value.trim())
const mutating = computed(() => savingEdit.value || deleting.value)
const canSaveEdit = computed(
  () =>
    trimmedEditDraft.value.length > 0 &&
    trimmedEditDraft.value.length <= MAX_LENGTH &&
    trimmedEditDraft.value !== props.post.text &&
    !mutating.value
)

const toggleLike = async () => {
  if (liking.value || props.isOwn) return
  liking.value = true
  try {
    await likeCommunityPost({ postId: props.post['.key'], liked: !liked.value })
  } catch {
    // useApi already reports the translated error; the listener keeps the card truthful.
  } finally {
    liking.value = false
  }
}

const beginEdit = () => {
  if (!props.isOwn || editing.value) return
  editDraft.value = props.post.text
  editing.value = true
  statusMessage.value = ''
  nextTick(() => document.getElementById(`post-edit-${props.post['.key']}`)?.focus())
}

const cancelEdit = () => {
  if (savingEdit.value) return
  editing.value = false
}

const saveEdit = async () => {
  if (!canSaveEdit.value) return
  savingEdit.value = true
  const draftAtSubmit = editDraft.value
  try {
    await saveCommunityPost({ postId: props.post['.key'], post: trimmedEditDraft.value })
    // If the user continued typing, keep the editor and their newer text.
    if (editDraft.value === draftAtSubmit) editing.value = false
    statusMessage.value = t('news.post-saved')
  } catch {
    // Keep the editor open; useApi already reports the translated error.
  } finally {
    savingEdit.value = false
  }
}

// Unlike a comment, a post takes other people's comments with it, so ask first.
const remove = async () => {
  if (mutating.value) return
  const answer = await confirm({
    title: t('news.delete-post'),
    message: t('news.delete-post-description'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    variant: 'destructive'
  })
  if (answer !== true) return
  deleting.value = true
  try {
    await deleteCommunityPost(props.post['.key'])
  } catch {
    // useApi already reports the translated error.
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="mt-2">
    <p
      v-if="!editing"
      class="text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
    >
      {{ post.text }}
    </p>

    <form v-else @submit.prevent="saveEdit">
      <label :for="`post-edit-${post['.key']}`" class="sr-only">{{ $t('news.edit-post') }}</label>
      <textarea
        :id="`post-edit-${post['.key']}`"
        v-model="editDraft"
        v-auto-grow
        :maxlength="MAX_LENGTH"
        rows="2"
        class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
      />
      <div class="mt-2 flex flex-wrap items-center justify-end gap-2">
        <span class="text-xs text-gray-400 dark:text-gray-500">
          {{ editDraft.length }}/{{ MAX_LENGTH }}
        </span>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            :disabled="mutating"
            class="inline-flex cursor-pointer items-center rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20 dark:focus-visible:outline-gray-400"
            @click="cancelEdit"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="mutating"
            class="inline-flex cursor-pointer items-center rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400 dark:focus-visible:outline-red-500"
            @click="remove"
          >
            {{ deleting ? $t('news.comment-deleting') : $t('common.delete') }}
          </button>
          <button
            type="submit"
            :disabled="!canSaveEdit"
            class="inline-flex cursor-pointer items-center rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500"
          >
            {{ savingEdit ? $t('news.comment-saving') : $t('common.save') }}
          </button>
        </div>
      </div>
    </form>

    <ActionBar v-if="currentUserId && post['.key']">
      <template #start>
        <ActionChip
          v-if="!isOwn"
          tone="rose"
          :active="liked"
          :disabled="liking"
          :aria-pressed="liked"
          :aria-label="$t('news.like-post')"
          :title="$t('news.like-post')"
          @click="toggleLike"
        >
          <LucideHeart :class="['h-4 w-4', liked ? 'fill-current' : '']" aria-hidden="true" />
          <span v-if="likeCount > 0">{{ likeCount }}</span>
        </ActionChip>
        <ActionChip v-else tone="rose" readonly :accent="likeCount > 0">
          <LucideHeart class="h-4 w-4" aria-hidden="true" />
          <span>{{ likeCount }}</span>
          <span class="sr-only">{{ $t('news.likes') }}</span>
        </ActionChip>
      </template>

      <template #end>
        <ActionChip
          tone="sky"
          :active="commentsExpanded"
          :accent="commentCount > 0"
          :aria-label="commentButtonLabel"
          :title="commentButtonLabel"
          :aria-expanded="commentsExpanded"
          :aria-controls="`post-comments-${post['.key']}`"
          @click="commentsExpanded = !commentsExpanded"
        >
          <LucideMessageCircle class="h-4 w-4" aria-hidden="true" />
          <span v-if="commentCount > 0">{{ visibleCommentCount }}</span>
        </ActionChip>
        <ActionChip
          v-if="isOwn && !editing"
          square
          :aria-label="$t('news.edit-post')"
          :title="$t('news.edit-post')"
          @click="beginEdit"
        >
          <LucidePencil class="h-4 w-4" aria-hidden="true" />
        </ActionChip>
        <!-- Further buttons of the screen that shows the post, such as admin ones -->
        <slot name="actions" />
      </template>
    </ActionBar>

    <CommunityPostComments
      v-if="currentUserId && post['.key']"
      :post-id="post['.key']"
      :post-author-id="post.authorId"
      :current-user-id="currentUserId"
      :expanded="commentsExpanded"
    />

    <p class="sr-only" aria-live="polite">{{ statusMessage }}</p>
  </div>
</template>
