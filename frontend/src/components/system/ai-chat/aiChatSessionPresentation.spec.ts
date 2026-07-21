import { describe, expect, it } from 'vitest'
import type { AiChatSessionItem } from '@/entity/entity'
import { formatSessionRuntimeSummary } from './aiChatSessionPresentation'

describe('formatSessionRuntimeSummary', () => {
  it('shows agent, provider, and model titles in the conversation header order', () => {
    const session = {
      agent: { handle: 'songbird', title: 'Songbird' },
      provider: { handle: 'openai', title: 'OpenAI' },
      model: { handle: 'gpt-5', title: 'GPT-5' },
    } as AiChatSessionItem

    expect(formatSessionRuntimeSummary(session)).toBe('Songbird / OpenAI / GPT-5')
  })

  it('uses relation handles and omits unavailable runtime parts', () => {
    const session = {
      agent: 'research-agent',
      provider: null,
      model: { handle: 'local-model', title: '' },
    } as AiChatSessionItem

    expect(formatSessionRuntimeSummary(session)).toBe('research-agent / local-model')
  })
})
