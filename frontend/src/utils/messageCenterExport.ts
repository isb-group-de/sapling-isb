import type { Message } from '@/composables/system/useSaplingMessageCenter'
import type { CreateGithubIssuePayload } from '@/services/api.github.service'

export interface MessageCenterExportPayload {
  source: 'sapling-log-message-center'
  exportedAt: string
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
}

const MAX_GITHUB_ISSUE_TITLE_LENGTH = 256

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
 * Creates a bug issue whose description contains the complete downloadable error payload.
 */
export function createErrorIssuePayload(
  message: Message,
  readableTitle: string,
  exportedAt = new Date(),
): CreateGithubIssuePayload {
  const exportPayload = createMessageCenterExportPayload([message], exportedAt)

  return {
    title: readableTitle.trim().slice(0, MAX_GITHUB_ISSUE_TITLE_LENGTH),
    description: `\`\`\`json\n${JSON.stringify(exportPayload, null, 2)}\n\`\`\``,
    type: 'bug',
  }
}
