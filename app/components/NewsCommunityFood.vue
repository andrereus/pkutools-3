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
const showNutrients = ref(false)

// A vote briefly swaps the selected button's thumb for a checkmark. The label
// and control stay in place, so the acknowledgement adds neither commentary on
// the choice nor a layout shift. Clearing a vote has nothing to acknowledge.
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
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-3">
      <span class="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
        {{ food.phe }} mg Phe
      </span>
      <span class="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
        {{ food.kcal }} {{ $t('common.kcal') }}
      </span>
      <button
        v-if="rows.length > 0"
        type="button"
        class="inline-flex cursor-pointer items-center gap-1 justify-self-end text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

    <p v-if="sourceLabel" class="mt-2 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
      {{ $t('food-search.value-source', { source: sourceLabel }) }}
    </p>

    <div
      v-if="food.note"
      class="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-gray-700 dark:bg-sky-900/20 dark:text-gray-300"
    >
      {{ food.note }}
    </div>

    <template v-if="canVote">
      <!-- Nothing is asked above them. The two labels already say what the
           buttons do, a question about knowing the food asks for more certainty
           than anyone usually has, and a prompt would frame the vote as the
           thing that vouches for a shared food. It is one signal, and not
           necessarily the only one this card will ever carry. -->
      <div class="mt-3 flex gap-2">
        <!-- Both stay clickable once cast, and the one you chose is marked. A
             vote is an impression, and changing your mind about a number is the
             normal thing to do — pressing the same one again clears it, which is
             what the vote route already does and what food search already
             offers. -->
        <button
          type="button"
          :disabled="busy"
          :aria-pressed="vote === 1"
          :aria-label="$t('news.looks-right')"
          :class="[
            'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-sm font-semibold ring-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 sm:gap-2 sm:px-3',
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
            'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-sm font-semibold ring-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 sm:gap-2 sm:px-3',
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
      </div>

      <span class="sr-only" aria-live="polite">
        {{ justVoted ? $t('news.vote-saved') : '' }}
      </span>
    </template>
  </div>
</template>
