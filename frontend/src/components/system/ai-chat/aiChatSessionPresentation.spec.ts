import { describe, expect, it } from 'vitest'
import type { AiChatSessionItem } from '@/entity/entity'
import { formatSessionRuntimeSummary, getSessionDateGroup } from './aiChatSessionPresentation'

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

describe('getSessionDateGroup', () => {
  const now = new Date('2026-07-21T12:00:00')

  it.each([
    ['2026-07-21T08:00:00', 'today'],
    ['2026-07-20T08:00:00', 'yesterday'],
    ['2026-07-17T08:00:00', 'lastSevenDays'],
    ['2026-07-01T08:00:00', 'older'],
  ])('groups a session from %s as %s', (lastMessageAt, expectedGroup) => {
    expect(getSessionDateGroup({ lastMessageAt } as unknown as AiChatSessionItem, now)).toBe(
      expectedGroup,
    )
  })
})
