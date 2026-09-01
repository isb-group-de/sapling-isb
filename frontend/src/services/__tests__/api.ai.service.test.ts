import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApiAiService from '../api.ai.service'

const pushApiErrorMessage = vi.hoisted(() => vi.fn())

vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage }))

describe('ApiAiService.streamMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports an HTTP stream failure with a translatable user-facing key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        body: null,
      }),
    )

    await expect(ApiAiService.streamMessage({ content: 'Hello' }, vi.fn())).rejects.toThrow(
      'ai.chat.streamFailed (503)',
    )
    expect(pushApiErrorMessage).toHaveBeenCalledWith(
      expect.any(Error),
      'aiChat.streamFailed',
      'aiChat',
    )
  })
})
