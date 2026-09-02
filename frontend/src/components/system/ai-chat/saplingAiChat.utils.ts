export interface SaplingAiChatPromptEventDetail {
  prompt?: string
  autoSend?: boolean
  newChat?: boolean
  agentHandle?: string
  playbookHandle?: string
  contextEntityHandle?: string
  contextRecordHandle?: string
}

export const SAPLING_AI_CHAT_TITLE_PREVIEW_LIMIT = 30
export const SAPLING_AI_CHAT_OVERLAY_Z_INDEX = 13000

export function createAsyncSingleFlight(task: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | null = null
  return () => {
    pending ??= task().finally(() => {
      pending = null
    })
    return pending
  }
}
