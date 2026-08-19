import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApiAiService from './api.ai.service'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
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
})
