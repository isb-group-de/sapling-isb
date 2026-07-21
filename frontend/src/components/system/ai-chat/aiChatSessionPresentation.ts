import type { AiChatSessionItem } from '@/entity/entity'

export type AiChatSessionActivity = 'responding' | 'unread'

export function getPersistedSessionActivity(
  session: AiChatSessionItem,
): AiChatSessionActivity | undefined {
  if (session.responseStatus === 'responding') return 'responding'

  const responseAt = toTimestamp(session.lastResponseAt)
  const readAt = toTimestamp(session.lastReadAt)
  return responseAt != null && (readAt == null || responseAt > readAt) ? 'unread' : undefined
}

type RuntimeReference =
  AiChatSessionItem['agent'] | AiChatSessionItem['provider'] | AiChatSessionItem['model']

export function formatSessionRuntimeSummary(session: AiChatSessionItem): string {
  return [session.agent, session.provider, session.model]
    .map(getRuntimeReferenceLabel)
    .filter((part) => part.length > 0)
    .join(' / ')
}

export type SessionDateGroup = 'today' | 'yesterday' | 'lastSevenDays' | 'older'

export function getSessionDateGroup(
  session: AiChatSessionItem,
  now: Date = new Date(),
): SessionDateGroup {
  const timestamp = getSessionDate(session)?.getTime() ?? 0
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const startOfLastSevenDays = new Date(startOfToday)
  startOfLastSevenDays.setDate(startOfLastSevenDays.getDate() - 7)

  if (timestamp >= startOfToday.getTime()) return 'today'
  if (timestamp >= startOfYesterday.getTime()) return 'yesterday'
  if (timestamp >= startOfLastSevenDays.getTime()) return 'lastSevenDays'
  return 'older'
}

export function getSessionDate(session: AiChatSessionItem): Date | null {
  const value = session.lastMessageAt || session.updatedAt || session.createdAt
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function getRuntimeReferenceLabel(reference: RuntimeReference): string {
  if (!reference) {
    return ''
  }

  if (typeof reference === 'string') {
    return reference
  }

  return reference.title?.trim() || String(reference.handle ?? '')
}

function toTimestamp(value?: Date | string | null): number | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  const timestamp = date.getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}
