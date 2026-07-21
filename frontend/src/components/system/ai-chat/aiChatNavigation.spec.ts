import { describe, expect, it } from 'vitest'
import type { AiChatMessageItem, AiChatToolActionItem } from '@/entity/entity'
import {
  extractEntityHandle,
  extractResultRecordHandle,
  getMessageNavigationLinks,
  getMessageToolActions,
  getToolActionNavigationLinks,
} from './aiChatNavigation'

function message(responsePayload: Record<string, unknown>): AiChatMessageItem {
  return { role: 'assistant', responsePayload } as AiChatMessageItem
}

function action(overrides: Partial<AiChatToolActionItem> = {}): AiChatToolActionItem {
  return {
    serverName: 'sapling',
    toolName: 'generic_update',
    status: 'executed',
    arguments: { entityHandle: 'ticket', handle: 42 },
    ...overrides,
  } as AiChatToolActionItem
}

describe('aiChatNavigation', () => {
  it('filters tool actions and suppresses message navigation while confirmation is pending', () => {
    const pendingAction = action({ status: 'pending' })
    const chatMessage = message({
      pendingToolActions: [pendingAction, null, { toolName: 'invalid' }],
      navigationLinks: [
        { path: '/table/ticket', entityHandle: 'ticket', kind: 'list', resultCount: 2 },
      ],
    })

    expect(getMessageToolActions(chatMessage)).toEqual([pendingAction])
    expect(getMessageNavigationLinks(chatMessage)).toEqual([])
  })

  it('keeps visible links, caps them, and resolves the primary route', () => {
    const links = [
      { path: '/route/primary', entityHandle: 'ticket', kind: 'route', isPrimary: true },
      { path: '', entityHandle: 'ticket', kind: 'route' },
      { path: '/hidden', entityHandle: 'ticket', kind: 'list', resultCount: 0 },
      { path: '/one', entityHandle: 'ticket', kind: 'record', resultCount: 1 },
      { path: '/two', entityHandle: 'ticket', kind: 'list', resultCount: 2 },
      { path: '/three', entityHandle: 'ticket', kind: 'list', resultCount: 3 },
    ]
    const chatMessage = message({ navigationLinks: links })

    expect(getMessageNavigationLinks(chatMessage).map((link) => link.path)).toEqual([
      '/route/primary',
      '/one',
      '/two',
    ])
  })

  it('builds mutation-result navigation from nested tool results', () => {
    const toolAction = action({
      arguments: { entityHandle: 'salesOpportunity' },
      resultPayload: { rawResult: { record: { handle: 'ABC-7' } } },
    })

    expect(extractEntityHandle(toolAction.arguments)).toBe('salesOpportunity')
    expect(extractResultRecordHandle(toolAction.resultPayload)).toBe('ABC-7')
    expect(getToolActionNavigationLinks(toolAction)).toEqual([
      expect.objectContaining({
        entityHandle: 'salesOpportunity',
        kind: 'record',
        path: expect.stringContaining('/table/salesOpportunity?filter='),
        recordHandles: ['ABC-7'],
      }),
    ])
  })
})
