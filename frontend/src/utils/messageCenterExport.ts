import type { Message } from '@/composables/system/useSaplingMessageCenter'
import type { CreateGithubIssuePayload } from '@/services/api.github.service'

export interface MessageCenterExportPayload {
  source: 'sapling-log-message-center'
  exportedAt: string
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
}

const MAX_GITHUB_ISSUE_TITLE_LENGTH = 256
const MAX_GITHUB_ISSUE_DESCRIPTION_LENGTH = 10_000
const MAX_ERROR_SUMMARY_LENGTH = 2_000
const MAX_ERROR_ENTITY_LENGTH = 256
const GITHUB_JSON_FENCE_PREFIX = '```json\n'
const GITHUB_JSON_FENCE_SUFFIX = '\n```'

/**
 * Builds the shared payload used by message-center downloads and automatic error reports.
 */
export function createMessageCenterExportPayload(
  messages: Message[],
  exportedAt = new Date(),
): MessageCenterExportPayload {
  return {
    source: 'sapling-log-message-center',
    exportedAt: exportedAt.toISOString(),
    messages: messages.map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
    })),
  }
}

/**
 * Creates a bug issue whose description contains the downloadable error payload.
 * Oversized diagnostics are shortened structurally so the payload stays valid JSON
 * and remains within the backend DTO limit.
 */
export function createErrorIssuePayload(
  message: Message,
  readableTitle: string,
  exportedAt = new Date(),
  sourceUrl?: string,
): CreateGithubIssuePayload {
  const exportPayload = createMessageCenterExportPayload([message], exportedAt)

  const payload: CreateGithubIssuePayload = {
    title: readableTitle.trim().slice(0, MAX_GITHUB_ISSUE_TITLE_LENGTH),
    description: buildGithubIssueDescription(exportPayload, message),
    type: 'bug',
  }

  if (sourceUrl) {
    payload.sourceUrl = sourceUrl
  }

  return payload
}

function buildGithubIssueDescription(
  exportPayload: MessageCenterExportPayload,
  message: Message,
): string {
  const completeDescription = wrapJsonForGithub(exportPayload)
  if (completeDescription.length <= MAX_GITHUB_ISSUE_DESCRIPTION_LENGTH) {
    return completeDescription
  }

  const diagnostics = JSON.stringify({
    technical: message.technical,
    descriptionParams: message.descriptionParams,
  })
  const basePayload = {
    source: exportPayload.source,
    exportedAt: exportPayload.exportedAt,
    truncated: true,
    originalDescriptionLength: completeDescription.length,
    messages: [
      {
        id: message.id,
        type: message.type,
        message: truncateText(message.message, MAX_ERROR_SUMMARY_LENGTH),
        description: truncateText(message.description, MAX_ERROR_SUMMARY_LENGTH),
        entity: truncateText(message.entity, MAX_ERROR_ENTITY_LENGTH),
        timestamp: message.timestamp.toISOString(),
        hidden: message.hidden,
        count: message.count,
        diagnosticsPreview: '',
      },
    ],
  }

  let lowerBound = 0
  let upperBound = diagnostics.length
  let fittingDescription = wrapJsonForGithub(basePayload)

  while (lowerBound <= upperBound) {
    const previewLength = Math.floor((lowerBound + upperBound) / 2)
    basePayload.messages[0].diagnosticsPreview = diagnostics.slice(0, previewLength)
    const candidate = wrapJsonForGithub(basePayload)

    if (candidate.length <= MAX_GITHUB_ISSUE_DESCRIPTION_LENGTH) {
      fittingDescription = candidate
      lowerBound = previewLength + 1
    } else {
      upperBound = previewLength - 1
    }
  }

  return fittingDescription
}

function wrapJsonForGithub(value: unknown): string {
  return `${GITHUB_JSON_FENCE_PREFIX}${JSON.stringify(value, null, 2)}${GITHUB_JSON_FENCE_SUFFIX}`
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}
