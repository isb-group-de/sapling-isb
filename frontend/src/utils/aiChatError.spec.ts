import { describe, expect, it } from 'vitest'
import { normalizeAiChatErrorMessage } from './aiChatError'

describe('normalizeAiChatErrorMessage', () => {
  it('classifies provider authorization failures without exposing raw text', () => {
    expect(
      normalizeAiChatErrorMessage('401 You have insufficient permissions for this operation.'),
    ).toBe('ai.providerAuthorizationFailed')
  })

  it('preserves translation keys and hides arbitrary provider errors', () => {
    expect(normalizeAiChatErrorMessage('ai.providerNotConfigured')).toBe('ai.providerNotConfigured')
    expect(normalizeAiChatErrorMessage('internal provider detail')).toBe('ai.chat.streamFailed')
  })
})
