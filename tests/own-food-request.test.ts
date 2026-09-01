import { describe, it, expect, vi, beforeEach } from 'vitest'

// A converted Phe, its protein, and its factor must travel together.

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useI18n', () => ({ locale: { value: 'de' } }))
vi.stubGlobal('useErrorHandler', () => ({ handleError: vi.fn() }))

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } })
}))

const { useApi } = await import('../app/composables/useApi')

const bodyOf = () => fetchMock.mock.calls[0]![1].body

const EDIT = {
  entryKey: 'entry1',
  name: 'Apfel',
  phe: 54,
  kcal: 52
}

describe('the own food update request', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ success: true })
  })

  it('carries a corrected conversion whole', async () => {
    await useApi().updateOwnFood({ ...EDIT, nutrients: { protein: 2 }, factor: 27 })

    expect(bodyOf().data).toMatchObject({
      phe: 54,
      nutrients: { protein: 2 },
      factor: 27
    })
  })

  it('leaves out what the caller did not mention', async () => {
    await useApi().updateOwnFood(EDIT)

    expect(bodyOf().data).not.toHaveProperty('nutrients')
    expect(bodyOf().data).not.toHaveProperty('factor')
  })

  it('sends an explicit null through, so a cleared conversion is not ignored', async () => {
    await useApi().updateOwnFood({ ...EDIT, nutrients: null, factor: null })

    expect(bodyOf().data.nutrients).toBeNull()
    expect(bodyOf().data.factor).toBeNull()
  })
})
