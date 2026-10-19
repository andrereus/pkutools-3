<script setup lang="ts">
import { useStore } from '../../stores/index'

const MAX_LENGTH = 1000
const MAX_NAME_LENGTH = 30

const emit = defineEmits<{ posted: [] }>()
const { t } = useI18n()
const { saveCommunityPost } = useApi()
const { current: currentName, saving: savingName, save: storeName } = useCommunityName()
const store = useStore()
// Admin posts appear as PKU Tools, whatever community name the account has.
const isAdmin = computed(() => store.isAdmin === true)
const shownName = computed(() => (isAdmin.value ? 'PKU Tools' : currentName.value))

const draft = ref('')
const saving = ref(false)
const statusMessage = ref('')
const trimmed = computed(() => draft.value.trim())
const canPost = computed(
  () => trimmed.value.length > 0 && trimmed.value.length <= MAX_LENGTH && !saving.value
)

// The name is opt-in, so the note always says whether one is attached.
const editingName = ref(false)
const nameDraft = ref('')

const openNameForm = () => {
  nameDraft.value = currentName.value ?? ''
  editingName.value = true
  nextTick(() => document.getElementById('news-community-name')?.focus())
}

const saveName = async () => {
  if (await storeName(nameDraft.value)) editingName.value = false
}

const submit = async () => {
  if (!canPost.value) return
  saving.value = true
  const draftAtSubmit = draft.value
  try {
    await saveCommunityPost({ post: trimmed.value })
    // Keep anything typed while the request was in flight.
    if (draft.value === draftAtSubmit) draft.value = ''
    statusMessage.value = t('news.post-saved')
    emit('posted')
  } catch {
    // useApi already reports the translated error.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    class="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
  >
    <form @submit.prevent="submit">
      <label for="news-post-input" class="sr-only">{{ $t('news.new-post') }}</label>
      <textarea
        id="news-post-input"
        v-model="draft"
        v-auto-grow
        :maxlength="MAX_LENGTH"
        rows="2"
        class="block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        :placeholder="$t('news.post-placeholder')"
      />
      <div class="mt-2 flex items-center justify-between gap-3">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{
            shownName
              ? $t('news.post-language-named', {
                  language: $t('app.language-name'),
                  name: shownName
                })
              : $t('news.post-language', { language: $t('app.language-name') })
          }}
          <button
            v-if="!editingName && !isAdmin"
            type="button"
            class="cursor-pointer font-medium text-sky-600 hover:underline dark:text-sky-400"
            @click="openNameForm"
          >
            {{ currentName ? $t('community.change-name') : $t('community.add-name') }}
          </button>
        </p>
        <div class="flex shrink-0 items-center gap-3">
          <span v-if="draft.length > 0" class="text-xs text-gray-400 dark:text-gray-500">
            {{ draft.length }}/{{ MAX_LENGTH }}
          </span>
          <button
            type="submit"
            :disabled="!canPost"
            class="cursor-pointer rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-sky-400"
          >
            {{ saving ? $t('news.posting') : $t('news.post-submit') }}
          </button>
        </div>
      </div>
    </form>

    <!-- A separate form, so Enter in the name field never publishes the post. -->
    <form
      v-if="editingName"
      class="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70"
      @submit.prevent="saveName"
    >
      <label
        for="news-community-name"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {{ $t('community.name') }}
      </label>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ $t('community.name-help') }}
      </p>
      <input
        id="news-community-name"
        v-model="nameDraft"
        type="text"
        :maxlength="MAX_NAME_LENGTH"
        class="mt-2 block w-full rounded-lg border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
      />
      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          @click="editingName = false"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="submit"
          :disabled="savingName"
          class="cursor-pointer rounded-full bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-sky-400"
        >
          {{ $t('common.save') }}
        </button>
      </div>
    </form>

    <p class="sr-only" aria-live="polite">{{ statusMessage }}</p>
  </div>
</template>
