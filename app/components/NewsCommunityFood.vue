<script setup>
import { foodSourceLabel } from '../utils/food-source-label'
import { nutrientRows } from '../utils/nutrition'

// The values of a shared community food, as they appear in a news entry, with
// the vote that belongs to them.
//
// It shows what the food-search detail card shows and no more: Phe, kcal, and
// whichever nutrients the record carries. No score and no vote counts — most
// shared foods have no votes because nobody was ever asked, and a count on the
// card would make those look deficient rather than simply new.
//
// `food` is the record itself, straight from `communityFoods` — the entry
// is derived from it rather than pointing at it, so there is no stale copy and
// no missing-food case to render.
const props = defineProps({
  food: { type: Object, required: true },
  /** This user's existing vote on the food: 1, -1, or null. */
  vote: { type: Number, default: null },
  /** Own contributions and signed-out visitors see the values without the ask. */
  canVote: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['vote'])
const { t } = useI18n()

// Casting a vote used to replace the buttons with a confirmation, which read as
// a small reward. Keeping the buttons live costs that, so the confirmation comes
// back as something that appears beside them and then leaves: the reward without
// the dead end. Clearing a vote is not congratulated — nothing was contributed.
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
</script>

<template>
  <div class="mt-3">
    <div class="flex gap-4 text-base font-semibold text-gray-900 dark:text-white">
      <span class="flex-1">{{ food.phe }} mg Phe</span>
      <span class="flex-1">{{ food.kcal }} {{ $t('common.kcal') }}</span>
    </div>

    <div
      v-if="rows.length > 0"
      class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
    >
      <div v-for="row in rows" :key="row.key" class="flex justify-between gap-2">
        <span>{{ row.label }}</span>
        <span>{{ row.value }} g</span>
      </div>
    </div>

    <p v-if="sourceLabel" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
      {{ $t('food-search.value-source', { source: sourceLabel }) }}
    </p>

    <div
      v-if="food.note"
      class="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-gray-700 dark:bg-sky-900/20 dark:text-gray-300"
    >
      {{ food.note }}
    </div>

    <template v-if="canVote">
      <p class="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-0.5"
          leave-active-class="transition duration-150 ease-in"
          leave-to-class="opacity-0"
          mode="out-in"
        >
          <span v-if="justVoted" key="thanks" class="font-medium text-teal-600 dark:text-teal-400">
            {{ $t('news.vote-thanks') }}
          </span>
          <span v-else key="ask">{{ $t('news.ask') }}</span>
        </Transition>
      </p>
      <div class="mt-2 flex gap-2">
        <!-- Both stay clickable once cast, and the one you chose is marked. A
             vote is an impression, and changing your mind about a number is the
             normal thing to do — pressing the same one again clears it, which is
             what the vote route already does and what food search already
             offers. -->
        <button
          type="button"
          :disabled="busy"
          :aria-pressed="vote === 1"
          :class="[
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50',
            vote === 1
              ? 'bg-teal-50 text-teal-700 ring-teal-400 dark:bg-teal-900/40 dark:text-teal-300 dark:ring-teal-700'
              : 'text-gray-700 ring-gray-300 hover:text-teal-600 hover:ring-teal-400 dark:text-gray-300 dark:ring-gray-600 dark:hover:text-teal-400'
          ]"
          @click="emit('vote', 1)"
        >
          <LucideThumbsUp class="h-4 w-4" />
          {{ $t('news.looks-right') }}
        </button>
        <button
          type="button"
          :disabled="busy"
          :aria-pressed="vote === -1"
          :class="[
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50',
            vote === -1
              ? 'bg-red-50 text-red-700 ring-red-400 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-700'
              : 'text-gray-700 ring-gray-300 hover:text-red-600 hover:ring-red-400 dark:text-gray-300 dark:ring-gray-600 dark:hover:text-red-400'
          ]"
          @click="emit('vote', -1)"
        >
          <LucideThumbsDown class="h-4 w-4" />
          {{ $t('news.looks-off') }}
        </button>
      </div>
    </template>
  </div>
</template>
