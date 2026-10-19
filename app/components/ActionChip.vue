<script setup>
// The one look for reactions, figures and actions on community content: a
// borderless pill with a light fill while it can be pressed, tinted while
// active, and plain coloured text when it only reports a figure.
const props = defineProps({
  /** Colour of the hover, active and accent states. */
  tone: {
    type: String,
    default: 'gray',
    validator: (value) => ['gray', 'teal', 'red', 'rose', 'sky'].includes(value)
  },
  /** The reader's own vote or like, or an open thread. */
  active: { type: Boolean, default: false },
  /** Idle text in the tone colour, e.g. a thread that already has comments. */
  accent: { type: Boolean, default: false },
  /** A figure rather than a control: no fill, not focusable. */
  readonly: { type: Boolean, default: false },
  /** Renders a link instead of a button. */
  to: { type: String, default: null },
  /** An icon without text. */
  square: { type: Boolean, default: false }
})

// Complete class strings, so Tailwind finds every one of them.
const TONES = {
  gray: {
    text: 'text-gray-700 dark:text-gray-200',
    active: 'bg-gray-200 text-gray-900 dark:bg-white/20 dark:text-white',
    hover: 'hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-white/15 dark:hover:text-white'
  },
  teal: {
    text: 'text-teal-700 dark:text-teal-300',
    active: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
    hover: 'hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-300'
  },
  red: {
    text: 'text-red-700 dark:text-red-300',
    active: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    hover: 'hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300'
  },
  rose: {
    text: 'text-rose-700 dark:text-rose-300',
    active: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    hover: 'hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-300'
  },
  sky: {
    text: 'text-sky-700 dark:text-sky-300',
    active: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    hover: 'hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-900/30 dark:hover:text-sky-300'
  }
}

const NuxtLink = resolveComponent('NuxtLink')
const tag = computed(() => (props.readonly ? 'span' : props.to ? NuxtLink : 'button'))

const classes = computed(() => {
  const tone = TONES[props.tone]
  if (props.readonly) {
    return [
      'inline-flex h-8 shrink-0 items-center gap-1.5 px-1 text-sm font-medium',
      props.accent ? tone.text : 'text-gray-500 dark:text-gray-400'
    ]
  }
  return [
    'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50',
    props.square ? 'w-8' : 'px-3',
    props.active
      ? tone.active
      : [
          'bg-gray-100 dark:bg-gray-800',
          props.accent ? tone.text : 'text-gray-600 dark:text-gray-400',
          tone.hover
        ]
  ]
})
</script>

<template>
  <component
    :is="tag"
    :to="to ?? undefined"
    :type="tag === 'button' ? 'button' : undefined"
    :class="classes"
  >
    <slot />
  </component>
</template>
