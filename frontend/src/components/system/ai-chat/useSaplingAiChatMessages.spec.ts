import { describe, expect, it } from 'vitest'
import type { AiChatMessageItem } from '@/entity/entity'
import { useSaplingAiChatMessages } from './useSaplingAiChatMessages'

describe('useSaplingAiChatMessages', () => {
  it('keeps the submitted question intact and marks only the response as failed', () => {
    const state = useSaplingAiChatMessages()

    state.appendLocalFailedExchange({
      content: 'Trigger the expected error',
      errorMessage: 'ai.chat.streamFailed',
      personHandle: 5,
      sessionHandle: 22,
    })

    expect(state.messages.value).toHaveLength(2)
    expect(state.messages.value[0]).toMatchObject({
      role: 'user',
      status: 'completed',
      content: 'Trigger the expected error',
    })
    expect(state.messages.value[1]).toMatchObject({
      role: 'assistant',
      status: 'failed',
      responsePayload: { error: 'ai.chat.streamFailed' },
    })
  })

  it('continues streaming duration from the persisted assistant timestamp after reload', () => {
    const state = useSaplingAiChatMessages()
    state.messages.value = [
      {
        handle: 12,
        role: 'assistant',
        status: 'streaming',
        sequence: 2,
        content: 'Partial answer',
        createdAt: new Date('2026-07-21T10:00:05Z'),
      } as AiChatMessageItem,
    ]
    state.streamingClock.value = new Date('2026-07-21T10:00:45Z').getTime()

    expect(state.streamingDurationByHandle.value[12]).toBe(40)
  })

  it('falls back to the persisted question timestamp for legacy streaming messages', () => {
    const state = useSaplingAiChatMessages()
    state.messages.value = [
      {
        handle: 11,
        role: 'user',
        status: 'completed',
        sequence: 1,
        content: 'Question',
        createdAt: new Date('2026-07-21T10:00:00Z'),
      } as AiChatMessageItem,
      {
        handle: 12,
        role: 'assistant',
        status: 'streaming',
        sequence: 2,
        content: '',
      } as AiChatMessageItem,
    ]
    state.streamingClock.value = new Date('2026-07-21T10:00:45Z').getTime()

    expect(state.streamingDurationByHandle.value[12]).toBe(45)
  })
})
