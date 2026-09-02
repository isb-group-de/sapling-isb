import type { AiChatMessageItem } from '@/entity/entity'
import { normalizeAiChatErrorMessage } from '@/utils/aiChatError'

type Translate = (key: string, params?: Record<string, unknown>) => string
type TranslationExists = (key: string) => boolean

interface ChatImportAttachment {
  attachmentHandle: number | null
  filename: string
  importBatchHandle: number | null
  summary?: {
    rowCount?: number
    headers?: unknown[]
    status?: string
  } | null
}

interface ChatWebSource {
  title: string
  url: string
}

export function useSaplingAiChatMessagePresentation(options: {
  t: Translate
  te: TranslationExists
}) {
  const { t, te } = options

  function getMessageWebSources(message: AiChatMessageItem): ChatWebSource[] {
    const sources = asRecord(message.responsePayload)?.sources
    if (!Array.isArray(sources)) return []

    const uniqueSources = new Map<string, ChatWebSource>()
    for (const value of sources) {
      const source = asRecord(value)
      if (source?.kind !== 'web' || typeof source.url !== 'string') continue
      try {
        const url = new URL(source.url)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
        uniqueSources.set(url.href, {
          url: url.href,
          title:
            typeof source.title === 'string' && source.title.trim()
              ? source.title.trim()
              : url.hostname.replace(/^www\./, ''),
        })
      } catch {
        continue
      }
    }

    return [...uniqueSources.values()].slice(0, 8)
  }

  function getMessageImportAttachments(message: AiChatMessageItem): ChatImportAttachment[] {
    const requestPayload = asRecord(message.requestPayload)
    const contextPayload = asRecord(message.contextPayload)
    const attachments = Array.isArray(requestPayload?.importAttachments)
      ? requestPayload.importAttachments
      : Array.isArray(contextPayload?.importAttachments)
        ? contextPayload.importAttachments
        : []

    return attachments.filter(isChatImportAttachment)
  }

  function isChatImportAttachment(value: unknown): value is ChatImportAttachment {
    return (
      !!value &&
      typeof value === 'object' &&
      typeof (value as { filename?: unknown }).filename === 'string'
    )
  }

  function formatImportAttachmentChip(attachment: ChatImportAttachment) {
    const rowCount =
      typeof attachment.summary?.rowCount === 'number'
        ? t('aiChat.attachmentRows', { count: attachment.summary.rowCount })
        : null
    const headerCount = Array.isArray(attachment.summary?.headers)
      ? t('aiChat.attachmentHeaders', { count: attachment.summary.headers.length })
      : null
    return [attachment.filename, rowCount, headerCount].filter(Boolean).join(' · ')
  }

  function getTransparencyChips(message: AiChatMessageItem): string[] {
    const payload = asRecord(message.responsePayload)

    if (!payload || message.role !== 'assistant') {
      return []
    }

    const toolResults = Array.isArray(payload.toolResults) ? payload.toolResults : []
    const sources = Array.isArray(payload.sources)
      ? payload.sources
      : Array.isArray(payload.navigationLinks)
        ? payload.navigationLinks
        : []
    const agentVersion = asRecord(payload.agentVersion)
    const playbook = asRecord(payload.playbook)
    const attachmentCount = getMessageImportAttachments(message).length
    const durationMs = getMessageDurationMs(message, payload)

    return [
      toolResults.length > 0 ? `${toolResults.length} ${t('aiChat.toolsUsed')}` : null,
      sources.length > 0 ? `${sources.length} ${t('aiChat.sourcesUsed')}` : null,
      attachmentCount > 0 ? `${attachmentCount} ${t('aiChat.attachmentsUsed')}` : null,
      durationMs != null
        ? `${getTranslationLabel('duration', 'Dauer')}: ${formatDurationMs(durationMs)}`
        : null,
      ...getUsageChips(payload),
      typeof agentVersion?.version === 'number' ? `v${agentVersion.version}` : null,
      typeof playbook?.title === 'string' ? playbook.title : null,
    ].filter((chip): chip is string => !!chip)
  }

  function formatMessageTime(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
  }

  function toDateTimeAttribute(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : ''
  }

  function getMessageDisplayContent(message: AiChatMessageItem) {
    if (message.status === 'failed') return getFailedMessageContent(message)
    return message.content?.trim() ? message.content : (message.content ?? '')
  }

  interface MessageProgressStep {
    id: string
    labelKey: string
    toolName: string
    status: string
  }

  interface MessageProgress {
    status: string
    reasoningSummary: string
    steps: MessageProgressStep[]
  }

  function getMessageProgress(message: AiChatMessageItem): MessageProgress | null {
    if (message.role !== 'assistant') return null
    const progress = asRecord(asRecord(message.responsePayload)?.progress)
    if (!progress) return null
    return {
      status: typeof progress.status === 'string' ? progress.status : message.status,
      reasoningSummary:
        typeof progress.reasoningSummary === 'string' ? progress.reasoningSummary : '',
      steps: Array.isArray(progress.steps)
        ? progress.steps
            .map((step) => asRecord(step))
            .filter((step): step is Record<string, unknown> => !!step)
            .map((step, index) => ({
              id: typeof step.id === 'string' ? step.id : String(index),
              labelKey: typeof step.labelKey === 'string' ? step.labelKey : '',
              toolName: typeof step.toolName === 'string' ? step.toolName : '',
              status: typeof step.status === 'string' ? step.status : 'completed',
            }))
        : [],
    }
  }

  function getProgressStepLabel(step: MessageProgressStep) {
    if (step.labelKey && te(step.labelKey)) return t(step.labelKey)
    if (step.toolName) {
      return t('aiChat.progressToolNamed', { tool: formatToolName(step.toolName) })
    }
    return t('aiChat.progressToolExecution')
  }

  function formatToolName(toolName: string) {
    return toolName
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toLocaleUpperCase())
  }

  function getMessageDurationMs(
    message: AiChatMessageItem,
    payload: Record<string, unknown>,
  ): number | null {
    const agentRun = asRecord(payload.agentRun)
    return (
      getFiniteNumber(payload.durationMs) ??
      getFiniteNumber(agentRun?.durationMs) ??
      getDurationBetweenDates(
        message.createdAt,
        getString(payload.completedAt) ?? message.updatedAt,
      )
    )
  }

  function getUsageChips(payload: Record<string, unknown>): string[] {
    const agentRun = asRecord(payload.agentRun)
    const usagePayload = asRecord(payload.usagePayload) ?? asRecord(agentRun?.usagePayload)

    if (!usagePayload) {
      return []
    }

    const totalTokens = getFirstFiniteNumber(usagePayload, [
      'totalTokens',
      'totalTokenCount',
      'total_tokens',
    ])
    const inputTokens = getFirstFiniteNumber(usagePayload, [
      'inputTokens',
      'promptTokens',
      'promptTokenCount',
      'prompt_tokens',
    ])
    const outputTokens = getFirstFiniteNumber(usagePayload, [
      'outputTokens',
      'completionTokens',
      'candidatesTokenCount',
      'completion_tokens',
    ])

    return [
      totalTokens != null
        ? `${getTranslationLabel('tokensUsed', 'Token')}: ${formatInteger(totalTokens)}`
        : null,
      inputTokens != null
        ? `${getTranslationLabel('inputTokens', 'Input')}: ${formatInteger(inputTokens)}`
        : null,
      outputTokens != null
        ? `${getTranslationLabel('outputTokens', 'Output')}: ${formatInteger(outputTokens)}`
        : null,
    ].filter((chip): chip is string => !!chip)
  }

  function getTranslationLabel(property: string, fallback: string) {
    const key = `aiChat.${property}`
    return te(key) ? t(key) : fallback
  }

  function formatDurationMs(durationMs: number) {
    const seconds = durationMs / 1000
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: seconds < 10 ? 1 : 0,
      minimumFractionDigits: seconds < 1 ? 1 : 0,
    }).format(seconds)} s`
  }

  function formatInteger(value: number) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
  }

  function getFirstFiniteNumber(
    payload: Record<string, unknown>,
    keys: readonly string[],
  ): number | null {
    for (const key of keys) {
      const value = getFiniteNumber(payload[key])
      if (value != null) {
        return value
      }
    }

    return null
  }

  function getFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  function getString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  }

  function getDurationBetweenDates(startValue: unknown, endValue: unknown): number | null {
    const start = getDateTime(startValue)
    const end = getDateTime(endValue)

    return start != null && end != null && end >= start ? end - start : null
  }

  function getDateTime(value: unknown): number | null {
    const timestamp =
      value instanceof Date
        ? value.getTime()
        : typeof value === 'string'
          ? new Date(value).getTime()
          : null

    return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null
  }

  function getFailedMessageContent(message: AiChatMessageItem) {
    const detail = getFailedMessageDetail(message)
    if (!message.content?.trim()) {
      return detail ? `${t('aiChat.requestFailed')}\n\n${detail}` : t('aiChat.requestFailed')
    }
    return detail
      ? `${message.content}\n\n${t('aiChat.requestFailed')}\n\n${detail}`
      : `${message.content}\n\n${t('aiChat.requestFailed')}`
  }

  function getFailedMessageDetail(message: AiChatMessageItem) {
    const rawError = asRecord(message.responsePayload)?.error
    const error = typeof rawError === 'string' ? rawError : ''
    const errorKey = normalizeAiChatErrorMessage(error)
    const errorLabel = error && te(errorKey) ? t(errorKey) : ''

    return error === 'ai.providerNotConfigured'
      ? [errorLabel || t('aiChat.noConfiguredProviders'), t('aiChat.contactAdministrator')]
          .filter(Boolean)
          .join(' ')
      : errorLabel
  }

  function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  return {
    formatImportAttachmentChip,
    formatMessageTime,
    getMessageDisplayContent,
    getMessageImportAttachments,
    getMessageProgress,
    getMessageWebSources,
    getProgressStepLabel,
    getTranslationLabel,
    getTransparencyChips,
    toDateTimeAttribute,
  }
}
