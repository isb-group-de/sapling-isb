import type { AiChatStreamEvent } from './api.ai.types'
import type { CreateAiChatMessagePayload } from './api.ai.types'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export function withClientTimeContext<
  T extends {
    clientCurrentDateTime?: string
    clientTimeZone?: string
    clientLocale?: string
    clientUtcOffsetMinutes?: number
  },
>(payload: T): T {
  const now = new Date()
  const resolvedOptions = Intl.DateTimeFormat().resolvedOptions()
  const timeZone = resolvedOptions.timeZone?.trim()
  const locale = navigator.language || resolvedOptions.locale

  return {
    ...payload,
    clientCurrentDateTime: now.toISOString(),
    clientTimeZone: timeZone || undefined,
    clientLocale: locale || undefined,
    clientUtcOffsetMinutes: -now.getTimezoneOffset(),
  }
}

export async function consumeAiChatStream(
  response: Response,
  onEvent: (event: AiChatStreamEvent) => void,
): Promise<void> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine) onEvent(JSON.parse(trimmedLine) as AiChatStreamEvent)
    }
  }

  const remaining = buffer.trim()
  if (remaining) onEvent(JSON.parse(remaining) as AiChatStreamEvent)
}

export async function streamAiChatMessage(
  payload: CreateAiChatMessagePayload,
  onEvent: (event: AiChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(buildApiUrl('ai/chat/stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(withClientTimeContext(payload)),
    signal,
  })

  if (!response.ok || !response.body) {
    const errorMessage = `ai.chat.streamFailed (${response.status})`
    pushApiErrorMessage(new Error(errorMessage), 'aiChat.streamFailed', 'aiChat')
    throw new Error(errorMessage)
  }

  await consumeAiChatStream(response, onEvent)
}
