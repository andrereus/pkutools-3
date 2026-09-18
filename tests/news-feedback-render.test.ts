import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as dates from 'date-fns'
import * as dateLocales from 'date-fns/locale'
import ts from 'typescript'
import * as grouping from '../app/utils/news-grouping'
import { communityFoodNotices } from '../app/composables/useNewsContext'

const filename = new URL('../app/pages/news.vue', import.meta.url).pathname
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
const script = compileScript(descriptor, { id: 'news', inlineTemplate: true })
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
})

const renderNews = async (locale: string, dislikes: number, pending: boolean) => {
  const messages = JSON.parse(
    readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8')
  )
  const t = (key: string, params: Record<string, unknown> = {}): string => {
    const text = key.split('.').reduce((value, part) => value[part], messages) as string
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
  }
  const notices = Vue.ref(
    communityFoodNotices(
      [
        {
          '.key': 'food1',
          name: 'Rice cake',
          language: 'de',
          createdAt: 100,
          contributorId: 'owner',
          likes: 0,
          dislikes,
          commentCount: 1,
          lastCommunityCommentAt: 200,
          lastContributorCommentAt: pending ? 0 : 300
        }
      ],
      'owner'
    )
  )
  const markReadAt = vi.fn()
  const localePath = vi.fn((route, language) => `/${language}/news${route.hash}`)
  const exports: { default?: Vue.Component } = {}
  runInNewContext(outputText, {
    exports,
    require: (id: string) => {
      if (id === 'vue') return Vue
      if (id === 'date-fns') return dates
      if (id === 'date-fns/locale') return dateLocales
      if (id === '../../stores/index') return { useStore: () => ({ user: { id: 'owner' } }) }
      if (id === '../utils/news-grouping') return grouping
      throw new Error(`Unexpected runtime import: ${id}`)
    },
    ...Vue,
    useI18n: () => ({ t, locale: Vue.ref(locale) }),
    useLocalePath: () => localePath,
    useRoute: () => ({ hash: '' }),
    useApi: () => ({ voteCommunityFood: vi.fn() }),
    useNews: () => ({
      items: Vue.ref([]),
      notices,
      commentEntries: Vue.ref(pending ? [{ key: 'comment-food1', createdAt: 200 }] : []),
      showHiddenFoods: Vue.ref(false),
      hasHiddenFoods: Vue.ref(false),
      userIsAuthenticated: Vue.ref(true)
    }),
    useNewsSeen: () => ({
      ready: Vue.ref(true),
      lastReadAt: Vue.ref(150),
      lastSeenRevision: Vue.ref(null),
      markReadAt,
      markRevision: vi.fn()
    }),
    definePageMeta: vi.fn(),
    useSeoMeta: vi.fn(),
    defineOgImage: vi.fn()
  })
  const app = Vue.createSSRApp(exports.default!)
  for (const name of ['PageHeader', 'PrimaryButton', 'ToggleSwitch', 'NewsCommunityFood']) {
    app.component(name, { render: () => Vue.h('span') })
  }
  app.component('NuxtLink', {
    props: ['to'],
    setup:
      (props, { slots }) =>
      () =>
        Vue.h('a', { href: props.to }, slots.default?.())
  })
  app.config.globalProperties.$t = t
  return { html: await renderToString(app), markReadAt, notices, localePath, t }
}

describe('contributor feedback notice rendering', () => {
  it.each(['en', 'de', 'es', 'fr'])(
    'renders comment-only feedback in %s and marks it read while keeping the notice',
    async (locale) => {
      const { html, markReadAt, notices, localePath, t } = await renderNews(locale, 1, true)
      expect(html).toContain(t('news.notice-own-comment-text'))
      expect(html).not.toContain(t('news.notice-own-flag-text', { count: 1 }))
      expect(html).not.toContain(t('news.notice-own-flag-hidden'))
      expect(html).toContain('href="/de/news#food-food1"')
      expect(localePath).toHaveBeenCalledWith({ name: 'news', hash: '#food-food1' }, 'de')
      expect(markReadAt).toHaveBeenCalledWith(200)
      expect(notices.value).toHaveLength(1)
    }
  )

  it('combines pending comments and hidden-food warnings in one link', async () => {
    const { html, t } = await renderNews('en', 3, true)
    expect(html).toContain(t('news.notice-own-comment-text'))
    expect(html).toContain(t('news.notice-own-flag-text', { count: 3 }))
    expect(html).toContain(t('news.notice-own-flag-hidden'))
    expect(html.match(/href="\/de\/news#food-food1"/g)).toHaveLength(1)
  })

  it('retains the rating warning after a reply without marking rating activity unread', async () => {
    const { html, markReadAt, t } = await renderNews('en', 2, false)
    expect(html).not.toContain(t('news.notice-own-comment-text'))
    expect(html).toContain(t('news.notice-own-flag-text', { count: 2 }))
    expect(markReadAt).not.toHaveBeenCalled()
  })
})
