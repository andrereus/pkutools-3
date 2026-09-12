import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive, ref, shallowRef, watch, type EffectScope } from 'vue'
import { useSettingsForm } from '../app/composables/useSettingsForm'

const defaults = {
  maxPhe: 300 as number | null,
  maxKcal: 2000 as number | null,
  bloodPheMin: 120 as number | null,
  bloodPheMax: 360 as number | null,
  bloodTyrMin: null as number | null,
  bloodTyrMax: null as number | null,
  labUnit: 'mgdl',
  license: null as string | null,
  progressStyle: 'circles',
  preferredTool: 'food-search',
  healthDataConsent: true
}
let store: {
  user: { id: string } | null
  settings: typeof defaults
  settingsLoaded: boolean
}
vi.mock('../stores/index', () => ({ useStore: () => store }))

const updateSettings = vi.fn()
const success = vi.fn()
const error = vi.fn()
let scope: EffectScope
let form: ReturnType<typeof useSettingsForm>

const deferred = () => {
  let resolve!: () => void
  let reject!: () => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = () => fail(new Error('Could not save'))
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  store = reactive({ user: { id: 'user-1' }, settings: { ...defaults }, settingsLoaded: true })
  updateSettings.mockReset().mockResolvedValue({ success: true })
  success.mockReset()
  error.mockReset()
  for (const [name, value] of Object.entries({ computed, reactive, ref, shallowRef, watch })) {
    vi.stubGlobal(name, value)
  }
  vi.stubGlobal('useApi', () => ({ updateSettings }))
  vi.stubGlobal('useNotifications', () => ({ success, error }))
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  scope = effectScope()
  form = scope.run(() => useSettingsForm())!
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})

describe('separate customization and app settings saves', () => {
  it('saves only the selected preference and protects unfinished form and license edits', async () => {
    form.appSettings.maxPhe = 450
    form.appSettings.labUnit = 'umoll'
    form.appSettings.license = 'unfinished-license'
    const request = deferred()
    updateSettings.mockReturnValueOnce(request.promise)

    const save = form.saveCustomization('progressStyle', 'bars')
    expect(updateSettings).toHaveBeenCalledWith({ progressStyle: 'bars' })
    expect(form.customization.value.progressStyle).toBe('bars')
    expect(store.settings.progressStyle).toBe('circles')
    expect(form.savingCustomization.value).toBe(true)

    // The Firebase listener replaces all settings when the preference is saved.
    store.settings = { ...defaults, progressStyle: 'bars', maxKcal: 2200 }
    request.resolve()
    await save

    expect(form.appSettings.maxPhe).toBe(450)
    expect(form.appSettings.labUnit).toBe('umoll')
    expect(form.appSettings.license).toBe('unfinished-license')
    expect(form.appSettings.maxKcal).toBe(2200)
    expect(form.savingCustomization.value).toBe(false)
    expect(success).not.toHaveBeenCalled()
  })

  it('uses Save for targets, ranges and units without resending customizations or the license', async () => {
    form.appSettings.maxPhe = 450
    form.appSettings.bloodPheMin = null
    form.appSettings.license = 'unfinished-license'
    await form.saveCustomization('preferredTool', 'ai-calculator')
    await form.save()

    expect(updateSettings.mock.calls.map(([payload]) => payload)).toEqual([
      { preferredTool: 'ai-calculator' },
      {
        maxPhe: 450,
        maxKcal: 2000,
        bloodPheMin: null,
        bloodPheMax: 360,
        bloodTyrMin: null,
        bloodTyrMax: null,
        labUnit: 'mgdl'
      }
    ])
    expect(success).toHaveBeenCalledWith('settings.saved')
  })

  it('restores the confirmed choice after failure and allows another attempt', async () => {
    updateSettings.mockRejectedValueOnce(new Error('Offline'))
    await form.saveCustomization('preferredTool', 'barcode-scanner')
    expect(form.customization.value.preferredTool).toBe('food-search')
    expect(store.settings.preferredTool).toBe('food-search')
    expect(form.customizationFailed.value).toBe(true)
    expect(form.savingCustomization.value).toBe(false)

    await form.saveCustomization('preferredTool', 'barcode-scanner')
    expect(form.customization.value.preferredTool).toBe('barcode-scanner')
    expect(form.customizationFailed.value).toBe(false)
  })

  it('prevents overlapping customization requests while the choices are disabled', async () => {
    const request = deferred()
    updateSettings.mockReturnValueOnce(request.promise)
    const save = form.saveCustomization('progressStyle', 'bars')
    await form.saveCustomization('progressStyle', 'circles')
    await form.saveCustomization('preferredTool', 'barcode-scanner')
    expect(updateSettings).toHaveBeenCalledTimes(1)
    request.resolve()
    await save
    await form.saveCustomization('progressStyle', 'bars')
    expect(updateSettings).toHaveBeenCalledTimes(1)
  })

  it('isolates account changes from unfinished saves and drafts', async () => {
    const first = deferred()
    const second = deferred()
    updateSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    form.appSettings.maxPhe = 450
    const oldSave = form.saveCustomization('progressStyle', 'bars')

    store.user = { id: 'user-2' }
    store.settings = { ...defaults, maxPhe: 600 }
    expect(form.appSettings.maxPhe).toBe(600)
    expect(form.customization.value.progressStyle).toBe('circles')
    const newSave = form.saveCustomization('preferredTool', 'phe-calculator')

    first.resolve()
    await oldSave
    expect(store.settings.progressStyle).toBe('circles')
    expect(form.savingCustomization.value).toBe(true)
    second.resolve()
    await newSave
    expect(store.settings.preferredTool).toBe('phe-calculator')
  })

  it('waits for account settings to load but does not require health consent for customization', async () => {
    store.settingsLoaded = false
    await form.saveCustomization('progressStyle', 'bars')
    expect(updateSettings).not.toHaveBeenCalled()
    store.settingsLoaded = true
    store.settings.healthDataConsent = false
    await form.saveCustomization('progressStyle', 'bars')
    expect(updateSettings).toHaveBeenCalledWith({ progressStyle: 'bars' })
    await form.save()
    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith('health-consent.no-consent')
  })

  it('keeps the form draft after Save fails', async () => {
    form.appSettings.maxPhe = 450
    updateSettings.mockRejectedValueOnce(new Error('Offline'))
    await form.save()
    expect(form.appSettings.maxPhe).toBe(450)
    expect(store.settings.maxPhe).toBe(300)
    expect(form.savingAppSettings.value).toBe(false)
    expect(success).not.toHaveBeenCalled()
  })
})
