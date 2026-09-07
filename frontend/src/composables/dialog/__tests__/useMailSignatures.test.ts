import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ settings: vi.fn(), findAll: vi.fn(), save: vi.fn() }))
vi.mock('@/services/api.mail-signature.service', () => ({
  loadMailSignatureSettings: mocks.settings,
  saveMailSignatureSettings: mocks.save,
}))
vi.mock('@/services/api.generic.service', () => ({ default: { findAll: mocks.findAll } }))
import { useMailSignatures } from '../useMailSignatures'

describe('personal composer signatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.settings.mockResolvedValue({ signatureRotation: true, defaultSignatureHandle: 12 })
    mocks.findAll.mockResolvedValue([
      { handle: 12, name: 'Bonn', isActive: true, useInRotation: false },
    ])
  })

  it('loads server preferences and keeps the fixed default when rotation is switched off', async () => {
    const state = useMailSignatures()
    await state.loadSignatures(true)
    expect(state.signaturePayload()).toEqual({
      signatureMode: 'rotation',
      signatureHandle: undefined,
    })
    state.signatureRotation.value = false
    expect(state.signaturePayload()).toEqual({ signatureMode: 'fixed', signatureHandle: 12 })
  })

  it('saves the composer choice as the server-side default', async () => {
    const state = useMailSignatures()
    await state.loadSignatures(true)
    state.signatureRotation.value = false
    await state.saveSignatureDefaults()
    expect(mocks.save).toHaveBeenCalledWith({
      signatureRotation: false,
      defaultSignatureHandle: 12,
    })
  })

  it('reuses the preview handle for sending and subsequent previews', async () => {
    const state = useMailSignatures()
    await state.loadSignatures(true)
    state.resolvedSignatureHandle.value = 23
    expect(state.signaturePayload()).toEqual({ signatureMode: 'rotation', signatureHandle: 23 })
    expect(state.signaturePayload()).toEqual({ signatureMode: 'rotation', signatureHandle: 23 })
  })

  it('sends an explicit none when the user clears the fixed selection', async () => {
    const state = useMailSignatures()
    await state.loadSignatures(true)
    state.signatureRotation.value = false
    state.signatureHandle.value = null
    expect(state.signaturePayload().signatureMode).toBe('none')
  })

  it('discards settings that finish loading after the dialog is closed', async () => {
    let resolve!: (value: unknown) => void
    mocks.settings.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const state = useMailSignatures()
    const loading = state.loadSignatures(true)
    state.resetSignatures()
    resolve({ signatureRotation: false, defaultSignatureHandle: 12 })
    await loading
    expect(state.signaturesReady.value).toBe(false)
    expect(state.signatureHandle.value).toBeNull()
  })

  it('leaves sending unavailable when loading preferences fails', async () => {
    mocks.settings.mockRejectedValue(new Error('network'))
    const state = useMailSignatures()
    await expect(state.loadSignatures(true)).rejects.toThrow('network')
    expect(state.signaturesReady.value).toBe(false)
  })
})
