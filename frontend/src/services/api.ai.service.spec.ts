import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApiAiService from './api.ai.service'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiAiService Markdown preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts the source Markdown and preferred runtime target', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { content: '## Professioneller Text' },
    })

    const result = await ApiAiService.prepareMarkdown({
      content: '## roher text',
      providerHandle: 'openai',
      modelHandle: 'gpt-5',
    })

    expect(axios.post).toHaveBeenCalledWith('/api/ai/markdown/prepare', {
      content: '## roher text',
      providerHandle: 'openai',
      modelHandle: 'gpt-5',
    })
    expect(result).toEqual({ content: '## Professioneller Text' })
  })

  it('persists a Songbird response rating', async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { handle: 42, role: 'assistant', rating: -1 },
    })

    const result = await ApiAiService.updateMessageRating(42, { rating: -1 })

    expect(axios.patch).toHaveBeenCalledWith('/api/ai/chat/messages/42/rating', {
      rating: -1,
    })
    expect(result).toMatchObject({ handle: 42, rating: -1 })
  })
})
