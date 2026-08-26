import { describe, expect, it } from 'vitest'
import type { AiAgentItem, AiProviderModelItem, SaplingGenericItem } from '@/entity/entity'
import {
  createEmptyAgentDraft,
  createEmptyEvaluationDraft,
  getNumberHandles,
  getModelProviderHandle,
  getStringHandles,
  mapHandlesToItems,
  normalizeRoleHandles,
  toAgentDraft,
  toAgentPayload,
} from '../aiAgentBuilder.utils'

describe('AI agent builder draft utilities', () => {
  it('creates safe defaults for a new confirm-first agent', () => {
    expect(createEmptyAgentDraft()).toMatchObject({
      handle: '',
      icon: 'mdi-creation',
      mutationMode: 'confirm',
      roles: [],
      isActive: true,
      isDefault: false,
      sortOrder: 100,
    })
    expect(createEmptyEvaluationDraft()).toEqual({
      title: '',
      prompt: '',
      expectedCriteria: '',
      agentVersionHandle: null,
    })
  })

  it('normalizes relation handles when an agent becomes an editable draft', () => {
    const draft = toAgentDraft({
      handle: 'support',
      title: 'Support',
      provider: { handle: 'openai' },
      model: { handle: 'gpt-5' },
      webSearchProvider: { handle: 'gemini' },
      webSearchModel: { handle: 'gemini-search' },
      roles: [{ handle: 7 }, 9],
      isActive: true,
      isDefault: false,
      sortOrder: 10,
    } as unknown as AiAgentItem)

    expect(draft.provider).toBe('openai')
    expect(draft.model).toBe('gpt-5')
    expect(draft.roles).toEqual([7, 9])
    expect(draft.webSearchProvider).toBe('gemini')
    expect(draft.webSearchModel).toBe('gemini-search')
  })

  it('resolves the owning provider for a directly selected model', () => {
    expect(
      getModelProviderHandle('gemini-search', [
        { handle: 'openai-chat', provider: { handle: 'openai' } },
        { handle: 'gemini-search', provider: { handle: 'gemini' } },
      ] as AiProviderModelItem[]),
    ).toBe('gemini')
    expect(getModelProviderHandle('missing', [])).toBeNull()
  })

  it('trims text fields while preserving explicit scopes in the API payload', () => {
    const draft = createEmptyAgentDraft()
    Object.assign(draft, {
      handle: ' support ',
      title: ' Support Agent ',
      description: ' Help users ',
      promptMarkdown: ' Be useful ',
      allowedEntityHandles: ['ticket'],
      webSearchProvider: 'gemini',
      roles: [7],
    })

    expect(toAgentPayload(draft)).toMatchObject({
      handle: 'support',
      title: 'Support Agent',
      description: 'Help users',
      promptMarkdown: 'Be useful',
      allowedEntityHandles: ['ticket'],
      webSearchProvider: 'gemini',
      roles: [7],
    })
  })

  it('maps selected generic items without inventing or coercing handles', () => {
    const items = [
      { handle: 'ticket', title: 'Ticket' },
      { handle: 7, title: 'Admin' },
      { handle: null, title: 'Unknown' },
    ] as SaplingGenericItem[]

    expect(mapHandlesToItems(['ticket'], items)).toEqual([items[0]])
    expect(getStringHandles(items)).toEqual(['ticket'])
    expect(getNumberHandles(items)).toEqual([7])
    expect(normalizeRoleHandles([{ handle: 7 }, 'invalid', 9])).toEqual([7, 9])
  })
})
