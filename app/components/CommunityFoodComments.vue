<script setup lang="ts">
import type { CommunityFoodComment } from '../composables/useApi'

const props = defineProps<{
  foodKey: string
  contributorId?: string | null
  currentUserId: string
  expanded: boolean
}>()

const { t, locale } = useI18n()
const { saveCommunityFoodComment, deleteCommunityFoodComment } = useApi()
const { comments, loading, loadFailed, start, stop } = useCommunityFoodComments(props.foodKey)

const draft = ref('')
const editDraft = ref('')
const editingCommentId = ref<string | null>(null)
const savingNew = ref(false)
const savingEdit = ref(false)
const deletingCommentId = ref<string | null>(null)
const statusMessage = ref('')
let statusTimer: ReturnType<typeof setTimeout> | null = null

const activeComment = computed(() =>
  comments.value.find((comment) => comment['.key'] === editingCommentId.value)
)
const trimmedDraft = computed(() => draft.value.trim())
const trimmedEditDraft = computed(() => editDraft.value.trim())
const mutating = computed(
  () => savingNew.value || savingEdit.value || deletingCommentId.value !== null
)
const canSaveNew = computed(
  () => trimmedDraft.value.length > 0 && trimmedDraft.value.length <= 300 && !mutating.value
)
const canSaveEdit = computed(
  () =>
    Boolean(activeComment.value) &&
    trimmedEditDraft.value.length > 0 &&
    trimmedEditDraft.value.length <= 300 &&
    trimmedEditDraft.value !== activeComment.value?.text &&
    !mutating.value
)

watch(
  () => props.expanded,
  (isExpanded) => {
    if (isExpanded) start()
    else stop()
  },
  { immediate: true }
)

watch(activeComment, (comment) => {
  if (editingCommentId.value && !comment) {
    editingCommentId.value = null
    editDraft.value = ''
  }
})

const clearEdit = () => {
  editingCommentId.value = null
  editDraft.value = ''
}

const announce = (message: string) => {
  if (statusTimer) clearTimeout(statusTimer)
  statusMessage.value = message
  statusTimer = setTimeout(() => {
    statusMessage.value = ''
    statusTimer = null
  }, 3000)
}

const saveNew = async () => {
  if (!canSaveNew.value) return
  savingNew.value = true
  const draftAtSubmit = draft.value
  try {
    await saveCommunityFoodComment({
      communityFoodKey: props.foodKey,
      comment: trimmedDraft.value
    })
    // Keep anything typed while the request was in flight as the next comment.
    if (draft.value === draftAtSubmit) draft.value = ''
    announce(t('news.comment-saved'))
  } catch {
    // useApi already reports the translated error.
  } finally {
    savingNew.value = false
  }
}

const beginEdit = (comment: CommunityFoodComment) => {
  if (
    mutating.value ||
    comment.authorId !== props.currentUserId ||
    editingCommentId.value === comment['.key']
  ) {
    return
  }
  editingCommentId.value = comment['.key']
  editDraft.value = comment.text
  statusMessage.value = ''
  nextTick(() => document.getElementById(`community-comment-edit-${comment['.key']}`)?.focus())
}

const cancelEdit = () => {
  if (savingEdit.value) return
  clearEdit()
}

const saveEdit = async () => {
  const commentId = editingCommentId.value
  if (!commentId || !canSaveEdit.value) return
  savingEdit.value = true
  const draftAtSubmit = editDraft.value
  try {
    await saveCommunityFoodComment({
      communityFoodKey: props.foodKey,
      commentId,
      comment: trimmedEditDraft.value
    })
    // If the user continued typing, retain the editor and their newer text.
    if (editingCommentId.value === commentId && editDraft.value === draftAtSubmit) clearEdit()
    announce(t('news.comment-saved'))
  } catch {
    // Keep the editor open; useApi already reports the translated error.
  } finally {
    savingEdit.value = false
  }
}

const remove = async (comment: CommunityFoodComment) => {
  const commentId = comment['.key']
  if (mutating.value || comment.authorId !== props.currentUserId) return
  deletingCommentId.value = commentId
  try {
    await deleteCommunityFoodComment({ communityFoodKey: props.foodKey, commentId })
    if (editingCommentId.value === commentId) clearEdit()
    announce(t('news.comment-deleted'))
  } catch {
    // useApi already reports the translated error.
  } finally {
    deletingCommentId.value = null
  }
}

const retry = () => {
  stop()
  start()
}

const authorLabel = (authorId: string) => {
  if (authorId === props.currentUserId) return t('news.comment-author-you')
  if (authorId === props.contributorId) return t('news.comment-author-contributor')
  return t('news.comment-author-community')
}

const isEditableComment = (comment: CommunityFoodComment) =>
  comment.authorId === props.currentUserId && editingCommentId.value !== comment['.key']

const formatCommentDate = (timestamp: number) =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'short'
  }).format(timestamp)

onUnmounted(() => {
  if (statusTimer) clearTimeout(statusTimer)
})
</script>

<template>
  <div
    v-if="expanded"
    :id="`community-comments-${foodKey}`"
    class="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800"
  >
    <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
      {{ $t('news.comments-loading') }}
    </p>
    <div
      v-else-if="loadFailed"
      class="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
    >
      <span>{{ $t('news.comments-load-failed') }}</span>
      <button type="button" class="cursor-pointer font-semibold hover:underline" @click="retry">
        {{ $t('news.comments-retry') }}
      </button>
    </div>
    <div v-else-if="comments.length > 0" class="space-y-2">
      <div
        v-for="comment in comments"
        :key="comment['.key']"
        :class="[
          'relative rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70',
          isEditableComment(comment)
            ? 'cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800'
            : ''
        ]"
      >
        <button
          v-if="isEditableComment(comment)"
          type="button"
          :disabled="mutating"
          class="absolute inset-0 z-10 cursor-pointer rounded-lg focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          @click="beginEdit(comment)"
        >
          <span class="sr-only">{{ $t('news.edit-comment') }}</span>
        </button>
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs leading-4 font-semibold text-gray-500 dark:text-gray-400">
            {{ authorLabel(comment.authorId) }}
          </p>
          <span class="flex shrink-0 items-center gap-1 text-gray-400 dark:text-gray-500">
            <LucidePencil
              v-if="comment.authorId === currentUserId"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            />
            <time class="text-xs leading-4" :datetime="new Date(comment.createdAt).toISOString()">
              {{ formatCommentDate(comment.createdAt) }}
            </time>
          </span>
        </div>

        <div v-if="editingCommentId !== comment['.key']" class="mt-1 flex items-start gap-3">
          <p
            class="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
          >
            {{ comment.text }}
          </p>
        </div>

        <form v-if="editingCommentId === comment['.key']" class="mt-2" @submit.prevent="saveEdit">
          <label :for="`community-comment-edit-${comment['.key']}`" class="sr-only">
            {{ $t('news.edit-comment') }}
          </label>
          <textarea
            :id="`community-comment-edit-${comment['.key']}`"
            v-model="editDraft"
            v-auto-grow
            maxlength="300"
            rows="1"
            class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
            :placeholder="$t('news.comment-placeholder')"
          />
          <div class="mt-2 flex flex-wrap items-center justify-end gap-2">
            <span class="text-xs text-gray-400 dark:text-gray-500">
              {{ editDraft.length }}/300
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
                @click="remove(comment)"
              >
                {{
                  deletingCommentId === comment['.key']
                    ? $t('news.comment-deleting')
                    : $t('common.delete')
                }}
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
      </div>
    </div>

    <form
      v-if="!loading && !loadFailed"
      :class="comments.length > 0 ? 'mt-3' : ''"
      @submit.prevent="saveNew"
    >
      <label
        :for="`community-comment-input-${foodKey}`"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {{ $t('news.your-comment') }}
      </label>
      <textarea
        :id="`community-comment-input-${foodKey}`"
        v-model="draft"
        v-auto-grow
        maxlength="300"
        rows="1"
        class="mt-1 block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        :placeholder="$t('news.comment-placeholder')"
      />
      <div class="mt-2 flex items-center justify-end gap-3">
        <span class="text-xs text-gray-400 dark:text-gray-500">{{ draft.length }}/300</span>
        <button
          type="submit"
          :disabled="!canSaveNew"
          class="cursor-pointer rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-sky-400"
        >
          {{ savingNew ? $t('news.comment-saving') : $t('common.save') }}
        </button>
      </div>
    </form>

    <p class="sr-only" aria-live="polite">{{ statusMessage }}</p>
  </div>
</template>
