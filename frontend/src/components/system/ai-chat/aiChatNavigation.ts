import type { AiChatMessageItem, AiChatToolActionItem } from '@/entity/entity'

export interface ChatNavigationLink {
  path: string
  entityHandle: string
  kind: 'list' | 'record' | 'route'
  intent?: 'searchResults' | 'record' | 'route' | 'mutationResult' | 'none'
  label?: string
  resultCount?: number | null
  recordHandles?: Array<string | number>
  toolName?: string
  isPrimary?: boolean
}

export function isToolAction(value: unknown): value is AiChatToolActionItem {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { serverName?: unknown }).serverName === 'string' &&
    typeof (value as { toolName?: unknown }).toolName === 'string' &&
    typeof (value as { status?: unknown }).status === 'string'
  )
}

export function getMessageToolActions(message: AiChatMessageItem): AiChatToolActionItem[] {
  const responsePayload = asRecord(message.responsePayload)
  const pendingActions = responsePayload?.pendingToolActions

  return Array.isArray(pendingActions) ? pendingActions.filter(isToolAction) : []
}

export function getMessageNavigationLinks(message: AiChatMessageItem): ChatNavigationLink[] {
  if (getMessageToolActions(message).some((action) => action.status === 'pending')) {
    return []
  }

  const navigationLinks = asRecord(message.responsePayload)?.navigationLinks

  return Array.isArray(navigationLinks)
    ? navigationLinks.filter(isChatNavigationLink).filter(isVisibleNavigationLink).slice(0, 3)
    : []
}

export function getPrimaryRouteNavigationLink(
  message: AiChatMessageItem,
): ChatNavigationLink | null {
  return (
    getMessageNavigationLinks(message).find(
      (link) => link.kind === 'route' && link.isPrimary !== false,
    ) ?? null
  )
}

export function getToolActionNavigationLinks(action: AiChatToolActionItem): ChatNavigationLink[] {
  if (
    action.status !== 'executed' ||
    (action.toolName !== 'generic_create' && action.toolName !== 'generic_update')
  ) {
    return []
  }

  const entityHandle =
    extractEntityHandle(action.arguments) ?? extractEntityHandle(action.resultPayload)
  const recordHandle =
    extractResultRecordHandle(action.resultPayload) ??
    extractHandleValue(asRecord(action.arguments)?.handle)

  if (!entityHandle || recordHandle == null) {
    return []
  }

  return [
    {
      path: buildEntityTablePath(entityHandle, { handle: recordHandle }),
      entityHandle,
      kind: 'record',
      intent: 'mutationResult',
      resultCount: 1,
      recordHandles: [recordHandle],
      toolName: action.toolName,
      isPrimary: true,
    },
  ]
}

export function isChatNavigationLink(value: unknown): value is ChatNavigationLink {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { path?: unknown }).path === 'string' &&
    typeof (value as { entityHandle?: unknown }).entityHandle === 'string' &&
    ((value as { kind?: unknown }).kind === 'list' ||
      (value as { kind?: unknown }).kind === 'record' ||
      (value as { kind?: unknown }).kind === 'route')
  )
}

export function isVisibleNavigationLink(link: ChatNavigationLink) {
  if (link.intent === 'none') {
    return false
  }

  if ((link.kind === 'list' || link.kind === 'record') && link.resultCount === 0) {
    return false
  }

  return !!link.path.trim()
}

export function buildEntityTablePath(entityHandle: string, filter: Record<string, unknown>) {
  return `/table/${entityHandle}?filter=${encodeURIComponent(JSON.stringify(filter))}`
}

export function extractEntityHandle(value: unknown): string | null {
  const record = asRecord(value)
  const directValue = record?.entityHandle

  if (typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim()
  }

  const argumentValue = asRecord(record?.arguments)?.entityHandle
  return typeof argumentValue === 'string' && argumentValue.trim() ? argumentValue.trim() : null
}

export function extractResultRecordHandle(value: unknown): string | number | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  return (
    extractHandleValue(record.handle) ??
    extractHandleValue(asRecord(record.record)?.handle) ??
    extractResultRecordHandle(record.rawResult) ??
    extractResultRecordHandle(record.modelResult)
  )
}

export function extractHandleValue(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
