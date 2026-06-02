<script setup>
import {
  LucideSparkles,
  LucideSearch,
  LucideScanBarcode,
  LucideCalculator,
  LucideCamera,
  LucidePlus,
  LucideChevronLeft,
  LucideChevronRight,
  LucideLock,
  LucideWifi,
  LucideCircleUser,
  LucideCircleCheck
} from 'lucide-vue-next'

const { t } = useI18n()

// Scripted hero demo — loops through three scenes like a short product video:
//   0) AI calculator: type a food in plain language, estimate, add it
//   1) the food lands in the diary and the daily Phe total updates
//   2) the charts (diet report + blood values) fill in
// Each scene's internal motion is CSS, replayed every loop via the :key remount.
// prefers-reduced-motion shows a single static scene with no animation.
// Numbers are illustrative sample data.
const scene = ref(0)
const sceneCount = 3
const durations = [6000, 3600, 3600]
let sceneTimer = null
let typeTimer = null
let typeStartTimer = null
let reduced = false

// What the user types into the AI calculator (plain-language food description);
// the AI resolves it to `query` (the named food) which then flows into the diary.
const aiPrompt = computed(() => t('home.demo-ai-prompt'))
const query = computed(() => t('home.diet-mgmt-food-2'))
const typed = ref('')

// Sample foods with real database-style Phe values (mg of phenylalanine).
const appleEmoji = '🍎'
const rollEmoji = '🥖'

// Insights mock data — same look as the illustrations on the landing page.
const dietBars = [180, 240, 310, 280, 350, 290, 320]
const dietMax = 400
// Blood values normalised to their own min/max so the trend fills the chart
// height; built into a line + a closed area for a proper chart look.
const blood = [380, 350, 330, 295, 270]
const bloodMin = Math.min(...blood)
const bloodMax = Math.max(...blood)
const bloodXY = blood.map((v, i) => ({
  x: (i / (blood.length - 1)) * 100,
  y: 4 + (1 - (v - bloodMin) / (bloodMax - bloodMin)) * 22
}))
const bloodLine = bloodXY.map((p) => `${p.x},${p.y}`).join(' ')
const bloodArea = `${bloodLine} 100,32 0,32`

const runTyping = () => {
  clearInterval(typeTimer)
  typed.value = ''
  const full = aiPrompt.value
  let i = 0
  typeTimer = setInterval(() => {
    typed.value = full.slice(0, i + 1)
    i += 1
    if (i >= full.length) clearInterval(typeTimer)
  }, 110)
}

const advance = () => {
  scene.value = (scene.value + 1) % sceneCount
  sceneTimer = setTimeout(advance, durations[scene.value])
}

watch(scene, (s) => {
  if (reduced) return
  if (s === 0) {
    clearTimeout(typeStartTimer)
    typeStartTimer = setTimeout(runTyping, 360)
  }
})

onMounted(() => {
  reduced = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    scene.value = 1
    typed.value = aiPrompt.value
    return
  }
  runTyping()
  sceneTimer = setTimeout(advance, durations[scene.value])
})

onBeforeUnmount(() => {
  clearTimeout(sceneTimer)
  clearTimeout(typeStartTimer)
  clearInterval(typeTimer)
})
</script>

<template>
  <div class="relative mx-auto w-full max-w-66 md:max-w-180" aria-hidden="true">
    <!-- soft gradient backdrop for depth -->
    <div
      class="absolute -inset-2 -z-10 rounded-[2.5rem] bg-linear-to-br from-sky-500/8 to-emerald-500/8 blur-lg dark:from-sky-400/8 dark:to-emerald-400/8"
      aria-hidden="true"
    />

    <!-- Device: iPhone bezel on small viewports, plain on md+ -->
    <div
      class="rounded-[2.75rem] bg-gray-900 p-2 shadow-lg ring-1 ring-black/5 md:rounded-xl md:bg-transparent md:p-0 md:shadow-none md:ring-0"
    >
      <!-- Screen -->
      <div
        class="relative overflow-hidden rounded-[2.25rem] bg-white md:rounded-xl md:shadow-lg md:ring-1 md:ring-gray-900/5 dark:bg-gray-900 dark:md:ring-white/10"
      >
        <!-- Dynamic Island (mobile) -->
        <div
          class="absolute left-1/2 top-2 z-20 h-5 w-16 -translate-x-1/2 rounded-full bg-black md:hidden"
          aria-hidden="true"
        />

        <!-- iPhone status bar (mobile) -->
        <div class="flex items-center justify-between px-5 pb-1 pt-3 md:hidden">
          <span class="text-xs font-semibold text-gray-900 dark:text-white">9:41</span>
          <div class="flex items-center gap-1.5 text-gray-900 dark:text-white">
            <span class="flex items-end gap-px" aria-hidden="true">
              <span class="h-1 w-0.5 rounded-xs bg-current" />
              <span class="h-1.5 w-0.5 rounded-xs bg-current" />
              <span class="h-2 w-0.5 rounded-xs bg-current" />
              <span class="h-2.5 w-0.5 rounded-xs bg-current" />
            </span>
            <LucideWifi class="h-3.5 w-3.5" aria-hidden="true" />
            <span
              class="relative flex h-3 w-5 items-center rounded-sm border border-current px-px"
              aria-hidden="true"
            >
              <span class="h-1.5 w-full rounded-xs bg-current" />
              <span class="absolute -right-1 h-1 w-0.5 rounded-r-sm bg-current" />
            </span>
          </div>
        </div>

        <!-- Browser chrome (md+) -->
        <div
          class="hidden h-10 items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 md:flex dark:border-white/10 dark:bg-gray-800/60"
        >
          <span class="h-3 w-3 rounded-full bg-red-400/80" aria-hidden="true" />
          <span class="h-3 w-3 rounded-full bg-amber-400/80" aria-hidden="true" />
          <span class="h-3 w-3 rounded-full bg-emerald-400/80" aria-hidden="true" />
          <div
            class="ml-3 flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-3 py-1 ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10"
          >
            <LucideLock class="h-3 w-3 text-gray-400" aria-hidden="true" />
            <span class="text-xs text-gray-500 dark:text-gray-400">pkutools.com</span>
          </div>
        </div>

        <!-- In-app header (shared) -->
        <div
          class="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-white/10"
        >
          <div class="flex items-center gap-2">
            <img class="h-5 w-auto" src="~/assets/pkutools-logo.png" alt="PKU Tools" />
            <span class="text-sm font-semibold text-gray-900 dark:text-white">PKU Tools</span>
          </div>
          <LucideCircleUser class="h-5 w-5 text-gray-600 dark:text-gray-300" aria-hidden="true" />
        </div>

        <!-- Scene area (fixed height to avoid layout shift) -->
        <div class="relative h-94 px-5 py-4 md:h-80">
          <Transition name="demo-scene" mode="out-in">
            <div :key="scene" class="h-full">
              <!-- SCENE 0: AI calculator — describe a food, estimate, add -->
              <div v-if="scene === 0" class="flex h-full flex-col">
                <!-- Tools tabs, like the app's AI-calculator page (AI tab active) -->
                <nav class="mb-4 flex justify-center gap-2" aria-label="Tabs">
                  <span
                    class="rounded-md bg-black/5 p-2 text-gray-700 dark:bg-white/15 dark:text-gray-300"
                  >
                    <LucideSparkles class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span class="rounded-md p-2 text-gray-500 dark:text-gray-300">
                    <LucideSearch class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span class="rounded-md p-2 text-gray-500 dark:text-gray-300">
                    <LucideScanBarcode class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span class="rounded-md p-2 text-gray-500 dark:text-gray-300">
                    <LucideCalculator class="h-4 w-4" aria-hidden="true" />
                  </span>
                </nav>

                <!-- Plain-language input (the AI calculator's textarea) -->
                <div class="min-h-14 rounded-xl bg-gray-100 px-3 py-2.5 dark:bg-gray-800">
                  <span class="text-sm text-gray-900 dark:text-white">{{ typed }}</span>
                  <span
                    class="demo-caret ml-px inline-block h-4 w-px translate-y-0.5 bg-sky-500"
                    aria-hidden="true"
                  />
                </div>

                <!-- Photo + Calculate actions -->
                <div class="mt-3 flex items-center gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <LucideCamera class="h-4 w-4" aria-hidden="true" />
                    {{ $t('ai-calculator.analyze-photo') }}
                  </span>
                  <span
                    class="demo-estimate inline-flex items-center justify-center rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {{ $t('home.demo-calculate') }}
                  </span>
                </div>

                <!-- AI result row (rises in after the estimate) -->
                <div
                  class="demo-result mt-4 flex items-center gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-gray-900/5 dark:bg-gray-800/60 dark:ring-white/10"
                >
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl dark:bg-gray-800"
                  >
                    <span aria-hidden="true">{{ appleEmoji }}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {{ query }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">180 g · 13 mg Phe</p>
                  </div>
                  <div
                    class="demo-add flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"
                  >
                    <LucidePlus class="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <!-- SCENE 1: Diary (daily total + bar at the top, then the log) -->
              <div v-else-if="scene === 1" class="flex h-full flex-col">
                <div class="flex items-center justify-center gap-3">
                  <LucideChevronLeft class="h-5 w-5 text-gray-400" aria-hidden="true" />
                  <span class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ $t('home.demo-today') }}
                  </span>
                  <LucideChevronRight class="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <!-- Daily total in the diary's gray summary box -->
                <div
                  class="relative mt-5 rounded-md bg-gray-50 px-3 py-3 shadow-inner md:mt-3 dark:bg-gray-800/60"
                >
                  <span class="demo-chip absolute -top-2 right-3 text-xs font-bold text-emerald-500">
                    +13 mg
                  </span>
                  <div class="flex items-baseline justify-between">
                    <span
                      class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >
                      Phe
                    </span>
                    <span class="text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                      266 / 400 mg
                    </span>
                  </div>
                  <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div class="demo-bar h-full rounded-full bg-sky-500" style="width: 66%" />
                  </div>
                </div>
                <div class="mt-4 space-y-2">
                  <div
                    class="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60"
                  >
                    <span class="text-lg" aria-hidden="true">{{ rollEmoji }}</span>
                    <span
                      class="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {{ $t('home.diet-mgmt-food-1') }} · 60 g
                    </span>
                    <span class="text-xs font-semibold text-gray-400 dark:text-gray-500"
                      >253 mg</span
                    >
                  </div>
                  <div
                    class="demo-item flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-600/10 dark:bg-emerald-400/10 dark:ring-emerald-400/20"
                  >
                    <span class="text-lg" aria-hidden="true">{{ appleEmoji }}</span>
                    <span class="flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                      {{ query }} · 180 g
                    </span>
                    <span class="text-xs font-semibold text-gray-500 dark:text-gray-400"
                      >13 mg</span
                    >
                  </div>
                </div>
              </div>

              <!-- SCENE 2: Insights -->
              <div v-else class="flex h-full flex-col gap-3">
                <div
                  class="rounded-xl bg-gray-50 px-3 py-3 ring-1 ring-gray-900/5 dark:bg-gray-800/60 dark:ring-white/10"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {{ $t('diet-report.title') }}
                    </span>
                    <LucideCircleCheck
                      class="demo-check demo-check-diet h-5 w-5 text-emerald-500"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="mt-2 flex h-16 items-end gap-1">
                    <div
                      v-for="(bar, i) in dietBars"
                      :key="i"
                      class="demo-grow flex-1 rounded-sm bg-sky-400 dark:bg-sky-500"
                      :style="{
                        height: (bar / dietMax) * 100 + '%',
                        animationDelay: `${0.2 + i * 0.05}s`
                      }"
                    />
                  </div>
                </div>
                <div
                  class="rounded-xl bg-gray-50 px-3 py-3 ring-1 ring-gray-900/5 dark:bg-gray-800/60 dark:ring-white/10"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {{ $t('blood-values.title') }}
                    </span>
                    <LucideCircleCheck
                      class="demo-check h-5 w-5 text-emerald-500"
                      aria-hidden="true"
                    />
                  </div>
                  <svg
                    viewBox="0 0 100 32"
                    class="demo-chart mt-2 h-16 w-full"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="demo-blood-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="rgb(14 165 233)" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="rgb(14 165 233)" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon :points="bloodArea" fill="url(#demo-blood-grad)" />
                    <polyline
                      :points="bloodLine"
                      fill="none"
                      stroke="rgb(14 165 233)"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      vector-effect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Scene progress dots -->
        <div class="flex items-center justify-center gap-1.5 pb-3">
          <span
            v-for="i in sceneCount"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-300"
            :class="scene === i - 1 ? 'w-5 bg-sky-500' : 'w-1.5 bg-gray-300 dark:bg-gray-600'"
            aria-hidden="true"
          />
        </div>

        <!-- iPhone home indicator (mobile) -->
        <div class="flex items-center justify-center pb-2 pt-1 md:hidden">
          <span class="h-1 w-28 rounded-full bg-gray-900/30 dark:bg-white/40" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scene crossfade */
.demo-scene-enter-active,
.demo-scene-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.demo-scene-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.demo-scene-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Search caret */
.demo-caret {
  animation: demo-blink 1s steps(1) infinite;
}

/* AI result card snaps in right after the Calculate tap, then holds long enough
   to read the values before the scene advances */
.demo-result {
  animation: demo-rise 0.5s ease-out 2.6s both;
}

/* Calculate button: a single firm press */
.demo-estimate {
  animation: demo-tap 0.9s cubic-bezier(0.22, 1, 0.36, 1) 2.2s 1;
}

/* Tap feedback on the add button — a firm press, a bounce overshoot, and a
   wide ripple so the "add" action reads clearly as the scene's key moment */
.demo-add {
  animation: demo-tap 1s cubic-bezier(0.22, 1, 0.36, 1) 4s 1;
}

/* Added item drops into the diary during the last part of the bar fill, landing
   just as the total completes (~1.2s) — the moment the new food is added */
.demo-item {
  animation: demo-drop 0.6s ease-out 0.6s both;
}

/* Daily total bar starts already mostly filled (the first food is logged) and fills
   the short remainder as the new food is added — synced with the item drop and "+13 mg"
   chip. easeOutExpo fill — launches fast with an even longer, softer tail. */
.demo-bar {
  transform-origin: left;
  animation: demo-fill 0.95s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both;
}

/* Floating "+13 mg" chip rises together with the food as it's added */
.demo-chip {
  animation: demo-float 1.7s ease-out 0.6s both;
}

/* Diet-report bars grow (per-bar delay set inline) */
.demo-grow {
  transform-origin: bottom;
  animation: demo-grow-y 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Blood-values chart wipes in left-to-right (whole line + area revealed) */
.demo-chart {
  animation: demo-wipe 1s ease-out 0.4s both;
}

/* Check marks pop in once each chart has finished drawing (diet first, blood after) */
.demo-check {
  transform-origin: center;
  animation: demo-pop 0.4s ease-out 1.5s both;
}
.demo-check-diet {
  animation-delay: 1.2s;
}

@keyframes demo-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@keyframes demo-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes demo-tap {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.6);
  }
  22% {
    transform: scale(0.82);
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.6);
  }
  55% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 16px rgba(14, 165, 233, 0);
  }
}

@keyframes demo-drop {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes demo-fill {
  from {
    transform: scaleX(0.7);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes demo-float {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  35% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-12px);
  }
}

@keyframes demo-grow-y {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

@keyframes demo-wipe {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes demo-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-scene-enter-active,
  .demo-scene-leave-active,
  .demo-caret,
  .demo-result,
  .demo-estimate,
  .demo-add,
  .demo-item,
  .demo-bar,
  .demo-chip,
  .demo-grow,
  .demo-chart,
  .demo-check {
    animation: none;
    transition: none;
  }
  .demo-chip {
    display: none;
  }
}
</style>
