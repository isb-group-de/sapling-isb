import { describe, expect, it } from 'vitest'
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
})
