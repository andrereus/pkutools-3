import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, readonly } from 'vue'

// Confirmation state persists through its close animation and supports
// back-to-back questions.

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

const { useConfirm } = await import('../app/composables/useConfirm')

const ASK = { title: 'Correct the food type?' }
const THEN_ASK = { title: 'Reset the votes?' }

describe('asking two questions in a row', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the second question open past the first one closing', async () => {
    const { confirm, handleConfirm, confirmState, showConfirm } = useConfirm()

    const first = confirm(ASK)
    handleConfirm()
    await expect(first).resolves.toBe(true)

    const second = confirm(THEN_ASK)
    // Long enough for the answered question's cleanup to have fired
    vi.advanceTimersByTime(1000)

    expect(confirmState.value).toMatchObject({ title: 'Reset the votes?' })
    expect(showConfirm.value).toBe(true)

    handleConfirm()
    await expect(second).resolves.toBe(true)
  })

  it('ignores a second report that the same question closed', async () => {
    const { confirm, handleConfirm, handleCancel, confirmState } = useConfirm()

    const answer = confirm(ASK)
    handleConfirm()
    handleCancel()
    await expect(answer).resolves.toBe(true)

    const second = confirm(THEN_ASK)
    vi.advanceTimersByTime(1000)

    expect(confirmState.value).toMatchObject({ title: 'Reset the votes?' })
    handleConfirm()
    await expect(second).resolves.toBe(true)
  })

  it('still clears the state once nothing is being asked', () => {
    const { confirm, handleCancel, confirmState, showConfirm } = useConfirm()

    confirm(ASK)
    handleCancel()
    expect(showConfirm.value).toBe(false)

    vi.advanceTimersByTime(300)
    expect(confirmState.value).toBeNull()
  })

  it('distinguishes dismissing the dialog from pressing its cancel button', async () => {
    const { confirm, handleCancel, handleDismiss } = useConfirm()

    const cancelled = confirm(ASK)
    handleCancel()
    await expect(cancelled).resolves.toBe(false)

    const dismissed = confirm(ASK)
    handleDismiss()
    await expect(dismissed).resolves.toBeNull()
  })

  it('answers a question that is replaced before anyone answers it', async () => {
    // Replacing a pending question must also resolve its promise.
    const { confirm, handleConfirm } = useConfirm()

    const abandoned = confirm(ASK)
    const replacement = confirm(THEN_ASK)

    await expect(abandoned).resolves.toBe(false)

    handleConfirm()
    await expect(replacement).resolves.toBe(true)
  })
})
