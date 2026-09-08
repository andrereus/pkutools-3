import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import ts from 'typescript'
import type { CommunityFoodThreadEntry } from '../app/composables/useApi'

// Compile the actual components with Vue's bundled compiler, without starting
// Firebase or a Nuxt server. This exercises the mixed thread's rendering paths.
const compileComponent = (name: string, globals: Record<string, unknown>): Vue.Component => {
  const filename = new URL(`../app/components/${name}.vue`, import.meta.url).pathname
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const script = compileScript(descriptor, { id: name, inlineTemplate: true })
  const { outputText } = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  })
  const exports: { default?: Vue.Component } = {}
  runInNewContext(outputText, {
    exports,
    require: (id: string) => {
      if (id === 'vue') return Vue
      throw new Error(`Unexpected runtime import: ${id}`)
    },
    ...Vue,
    ...globals
  })
  return exports.default!
}

const renderThread = async (locale: string, entries: CommunityFoodThreadEntry[]) => {
  const messages = JSON.parse(
    readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8')
  )
  const t = (key: string, params: Record<string, string> = {}): string => {
    const text = key.split('.').reduce((value, part) => value[part], messages) as string
    return text.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`)
  }
  const globals = {
    useI18n: () => ({ t, locale: Vue.ref(locale) }),
    useApi: () => ({ saveCommunityFoodComment: vi.fn(), deleteCommunityFoodComment: vi.fn() }),
    useCommunityFoodComments: () => ({
      comments: Vue.ref(entries),
      loading: Vue.ref(false),
      loadFailed: Vue.ref(false),
      start: vi.fn(),
      stop: vi.fn()
    })
  }
  const app = Vue.createSSRApp(compileComponent('CommunityFoodComments', globals), {
    foodKey: 'food1',
    contributorId: 'owner',
    currentUserId: 'owner',
    expanded: true
  })
  app.component('CommunityFoodHistory', compileComponent('CommunityFoodHistory', globals))
  app.component('LucidePencil', { render: () => Vue.h('span') })
  app.directive('auto-grow', {})
  app.config.globalProperties.$t = t
  return { html: await renderToString(app), t }
}

describe('comments and food history rendering', () => {
  it.each([
    ['de', 'Phe-Wert und Notiz geändert'],
    ['en', 'Phe value and Note changed'],
    ['es', 'Cambios: Valor de Phe y Nota'],
    ['fr', 'Modifications : Valeur de Phe et Note']
  ])(
    'renders a general history-only thread in %s with an available comment form',
    async (locale, description) => {
      const { html, t } = await renderThread(locale, [
        {
          '.key': 'history',
          type: 'content-update',
          createdAt: 200,
          changedFields: ['phe', 'note']
        }
      ])
      expect(html).toContain(description)
      expect(html).not.toContain('<details')
      expect(html).toContain('community-comment-input-food1')
      expect(html).not.toContain(t('news.edit-comment'))
    }
  )

  it('keeps feedback, the edit, and the contributor reply in order with editing only on the reply', async () => {
    const { html, t } = await renderThread('en', [
      {
        '.key': 'feedback',
        type: 'comment',
        authorId: 'reader',
        text: 'Please check this value.',
        createdAt: 100,
        updatedAt: 100
      },
      {
        '.key': 'edit',
        type: 'content-update',
        createdAt: 200,
        changedFields: ['phe']
      },
      {
        '.key': 'reply',
        type: 'comment',
        authorId: 'owner',
        text: 'Corrected, thanks!',
        createdAt: 300,
        updatedAt: 300
      }
    ])
    expect(html.indexOf('Please check this value.')).toBeLessThan(html.indexOf('Phe value changed'))
    expect(html.indexOf('Phe value changed')).toBeLessThan(html.indexOf('Corrected, thanks!'))
    expect(html.split(t('news.edit-comment'))).toHaveLength(2)
  })

  it('shows a general edit notice when an older client cannot recognize a field', async () => {
    const { html, t } = await renderThread('de', [
      {
        '.key': 'edit',
        type: 'content-update',
        createdAt: 200,
        changedFields: []
      }
    ])
    expect(html).toContain(t('news.food-edited'))
    expect(html).not.toContain(t('news.edit-comment'))
  })
})
