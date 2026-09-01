export function normalizeAiChatErrorMessage(error: unknown): string {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'aiChat.streamFailed'
  const trimmedMessage = rawMessage.trim()

  if (!trimmedMessage || trimmedMessage.startsWith('ai.chat.streamFailed')) {
    return 'aiChat.streamFailed'
  }

  if (
    /(^|\s)401(\s|$)/.test(trimmedMessage) &&
    /insufficient permissions|unauthori[sz]ed|authentication|api key/i.test(trimmedMessage)
  ) {
    return 'ai.providerAuthorizationFailed'
  }

  return /^[a-z]+(?:\.[a-zA-Z0-9_-]+)+$/.test(trimmedMessage)
    ? trimmedMessage
    : 'aiChat.streamFailed'
}
