import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import ApiAiService from '@/services/api.ai.service'
import { useSaplingAiChatAttachments } from './useSaplingAiChatAttachments'
import { clipboardImageFiles } from './aiChatImages'
vi.mock('@/services/api.ai.service', () => ({ default: { createChatImage: vi.fn() } }))

describe('image attachments', () => {
  beforeEach(() => vi.clearAllMocks())
  const file = new File(['image'], 'screen.png', { type: 'image/png' })
  function setup() {
    const canUpload = ref(true)
    const reportError = vi.fn()
    const state = useSaplingAiChatAttachments(ref(false), () => 7, {
      canUpload,
      target: () => ({ modelHandle: 'vision' }),
      reportError,
    })
    return { ...state, canUpload, reportError }
  }
  it('accepts several images, preserves filenames and removes a selected attachment', async () => {
    vi.mocked(ApiAiService.createChatImage)
      .mockResolvedValueOnce({
        attachment: { handle: 1, filename: 'screen.png', status: 'uploaded' },
      } as never)
      .mockResolvedValueOnce({
        attachment: { handle: 2, filename: 'other.png', status: 'uploaded' },
      } as never)
    const state = setup()
    await state.uploadImageAttachments([file, file])
    expect(state.pendingAttachments.value.map((item) => item.handle)).toEqual([1, 2])
    expect(ApiAiService.createChatImage).toHaveBeenCalledWith(file, {
      sessionHandle: 7,
      modelHandle: 'vision',
    })
    state.removeImportAttachment(1)
    expect(state.pendingAttachments.value.map((item) => item.handle)).toEqual([2])
  })
  it('rejects non-vision models, excessive counts and invalid files before uploading', async () => {
    const state = setup()
    state.canUpload.value = false
    await state.uploadImageAttachments([file])
    expect(state.reportError).toHaveBeenLastCalledWith('ai.chatVisionRequired')
    state.canUpload.value = true
    await state.uploadImageAttachments(Array(6).fill(file))
    expect(state.reportError).toHaveBeenLastCalledWith('ai.chatImageCountLimit')
    await state.uploadImageAttachments([new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })])
    expect(state.reportError).toHaveBeenLastCalledWith('ai.chatImageInvalid')
    expect(ApiAiService.createChatImage).not.toHaveBeenCalled()
  })
  it('does not attach a late upload to a newly opened conversation', async () => {
    let resolve!: (value: never) => void
    vi.mocked(ApiAiService.createChatImage).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const state = setup()
    const uploading = state.uploadImageAttachments([file])
    state.resetImportAttachments()
    resolve({ attachment: { handle: 1, filename: 'old.png' } } as never)
    await uploading
    expect(state.pendingAttachments.value).toEqual([])
  })
  it('extracts clipboard images while leaving text-only clipboard data alone', () => {
    expect(
      clipboardImageFiles({
        clipboardData: { items: [{ kind: 'string', type: 'text/plain' }] },
      } as unknown as ClipboardEvent),
    ).toEqual([])
    expect(
      clipboardImageFiles({
        clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] },
      } as unknown as ClipboardEvent),
    ).toEqual([file])
  })
})
