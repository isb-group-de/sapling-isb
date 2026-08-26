import type { AiAgentRunItem } from '@/entity/entity'

export type AgentRunTraceRecord = Record<string, unknown>

export type AgentRunUsageMetrics = {
  totalTokens: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export function getRunToolCalls(run: AiAgentRunItem): AgentRunTraceRecord[] {
  return toRecords(run.toolCalls)
}

export function getRunSources(run: AiAgentRunItem): AgentRunTraceRecord[] {
  return toRecords(run.sources)
}

export function getRunPendingActions(run: AiAgentRunItem): AgentRunTraceRecord[] {
  return toRecords(run.pendingActions)
}

export function getRunRepairHints(run: AiAgentRunItem): string[] {
  return getRunToolCalls(run).flatMap((toolCall) => toStringArray(toolCall.repairHints))
}

export function getRunUsageMetrics(run: AiAgentRunItem): AgentRunUsageMetrics {
  const payload = isRecord(run.usagePayload) ? run.usagePayload : {}

  return {
    totalTokens: getFirstFiniteNumber(payload, ['totalTokens', 'totalTokenCount', 'total_tokens']),
    inputTokens: getFirstFiniteNumber(payload, [
      'inputTokens',
      'promptTokens',
      'promptTokenCount',
      'prompt_tokens',
    ]),
    outputTokens: getFirstFiniteNumber(payload, [
      'outputTokens',
      'completionTokens',
      'candidatesTokenCount',
      'completion_tokens',
    ]),
  }
}

export function hasUsageMetrics(metrics: AgentRunUsageMetrics): boolean {
  return Object.values(metrics).some((value) => value != null)
}

export function formatRunToolLabel(toolCall: AgentRunTraceRecord): string {
  const serverName = toText(toolCall.serverName)
  const toolName = toText(toolCall.toolName)
  return [serverName, toolName].filter(Boolean).join('.') || 'Tool'
}

export function formatRunSourceTitle(source: AgentRunTraceRecord): string {
  const label = toText(source.label)
  const title = toText(source.title)
  const path = toText(source.path)
  const url = toText(source.url)
  const entityHandle = toText(source.entityHandle)
  const toolName = toText(source.toolName)

  return (
    label ||
    title ||
    path ||
    url ||
    [entityHandle, toolName].filter(Boolean).join(' · ') ||
    'Quelle'
  )
}

export function formatRunSourceMeta(source: AgentRunTraceRecord): string[] {
  const serverName = toText(source.serverName)
  const toolName = toText(source.toolName)

  return [
    toText(source.kind),
    [serverName, toolName].filter(Boolean).join('.'),
    [toText(source.providerHandle), toText(source.modelHandle)].filter(Boolean).join(' · '),
    toText(source.status),
  ].filter(Boolean)
}

export function getRunSourceUrl(source: AgentRunTraceRecord): string | null {
  const value = toText(source.url)
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function formatRunError(run: AiAgentRunItem): string | null {
  if (!isRecord(run.errorPayload)) return null

  for (const key of ['message', 'error', 'detail', 'status']) {
    const value = formatTraceValue(run.errorPayload[key], 600)
    if (value) return value
  }

  return formatTraceValue(run.errorPayload, 600)
}

export function getTraceArguments(toolCall: AgentRunTraceRecord): Array<{
  key: string
  value: string
}> {
  if (!isRecord(toolCall.arguments)) return []

  return Object.entries(toolCall.arguments)
    .slice(0, 8)
    .map(([key, value]) => ({ key, value: formatTraceValue(value, 240) || '–' }))
}

export function formatTraceValue(value: unknown, maxLength = 240): string {
  if (value == null) return ''

  let result: string
  if (typeof value === 'string') result = value.trim()
  else if (typeof value === 'number' || typeof value === 'boolean') result = String(value)
  else {
    try {
      result = JSON.stringify(value)
    } catch {
      return ''
    }
  }

  return result.length > maxLength ? `${result.slice(0, maxLength - 1)}…` : result
}

export function formatRunDuration(durationValue?: unknown, locale?: string): string {
  const durationMs = getFiniteNumber(durationValue)
  if (durationMs == null) return '–'

  if (durationMs < 1000) return `${Math.round(durationMs)} ms`

  const seconds = durationMs / 1000
  if (seconds < 60) {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: seconds < 10 ? 1 : 0,
    }).format(seconds)} s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes} min ${remainingSeconds} s`
}

export function formatRunInteger(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  return null
}

function getFirstFiniteNumber(
  payload: AgentRunTraceRecord,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = getFiniteNumber(payload[key])
    if (value != null) return value
  }

  return null
}

function toRecords(value: unknown): AgentRunTraceRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : []
}

function isRecord(value: unknown): value is AgentRunTraceRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
