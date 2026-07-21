import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiChatMessageItem, AiChatSessionItem } from '@/entity/entity'
import { useSaplingAiChatSessions } from './useSaplingAiChatSessions'

const api = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listMessages: vi.fn(),
  markSessionRead: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/services/api.ai.service', () => ({ default: api }))

function setup(activeSession: AiChatSessionItem | null) {
  const activeSessionRef = ref(activeSession)
  const messages = ref<AiChatMessageItem[]>([])
  const state = useSaplingAiChatSessions({
    activeSession: activeSessionRef,
    messages,
    hasMoreMessages: ref(false),
    nextMessageBeforeSequence: ref(null),
    selectedPlaybookHandle: ref(null),
    resetMessageWindow: vi.fn(),
    mergeMessages: (older, current) => [...older, ...current],
    syncSelectedAgent: vi.fn(),
    syncSelectedPlaybook: vi.fn(),
    getPlaybookHandle: () => null,
    onActiveSessionArchived: vi.fn(),
  })
  return { state, activeSession: activeSessionRef, messages }
}

describe('useSaplingAiChatSessions persisted activity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refreshes persisted checkpoints and detects a terminal response after reload', async () => {
    const runningSession = {
      handle: 7,
      title: 'Long response',
      responseStatus: 'responding',
    } as AiChatSessionItem
    const completedSession = {
      ...runningSession,
      responseStatus: 'idle',
      lastResponseAt: new Date('2026-07-21T10:00:00Z'),
    } as AiChatSessionItem
    const completedMessage = {
      handle: 12,
      session: 7,
      role: 'assistant',
      status: 'completed',
      sequence: 2,
      content: 'Finished answer',
    } as AiChatMessageItem
    api.listSessions.mockResolvedValue([completedSession])
    api.listMessages.mockResolvedValue({
      data: [completedMessage],
      meta: { hasMore: false, nextBeforeSequence: null },
    })
    const testState = setup(runningSession)

    const completed = await testState.state.refreshPersistedActivity()

    expect(completed).toBe(true)
    expect(testState.activeSession.value).toEqual(completedSession)
    expect(testState.messages.value).toEqual([completedMessage])
    expect(api.listSessions).toHaveBeenCalledWith(false, { suppressErrorMessage: true })
  })

  it('persists the read marker and replaces the session state', async () => {
    const unreadSession = {
      handle: 7,
      title: 'Unread response',
      responseStatus: 'idle',
      lastResponseAt: new Date('2026-07-21T10:00:00Z'),
      lastReadAt: new Date('2026-07-21T09:00:00Z'),
    } as AiChatSessionItem
    const readSession = {
      ...unreadSession,
      lastReadAt: new Date('2026-07-21T11:00:00Z'),
    } as AiChatSessionItem
    api.markSessionRead.mockResolvedValue(readSession)
    const testState = setup(unreadSession)

    await testState.state.markSessionRead(7)

    expect(api.markSessionRead).toHaveBeenCalledWith(7)
    expect(testState.activeSession.value).toEqual(readSession)
    expect(testState.state.sessions.value).toEqual([readSession])
  })
})
