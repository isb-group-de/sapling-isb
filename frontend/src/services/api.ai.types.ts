import type {
  AiAgentItem,
  AiAgentEvaluationItem,
  AiAgentMemoryItem,
  AiAgentPlaybookItem,
  AiAgentRunItem,
  AiAgentVersionItem,
  AiChatAttachmentItem,
  AiChatMessageItem,
  AiChatSessionItem,
  AiChatToolActionItem,
} from '@/entity/entity'

export interface CreateAiChatSessionPayload {
  title?: string
  providerHandle?: string
  modelHandle?: string
  agentHandle?: string
  agentVersionHandle?: number
  playbookHandle?: string
  contextEntityHandle?: string
  contextRecordHandle?: string
}

export interface UpdateAiChatSessionPayload {
  title?: string
  isArchived?: boolean
  providerHandle?: string
  modelHandle?: string
  agentHandle?: string
  agentVersionHandle?: number
  playbookHandle?: string
  contextEntityHandle?: string
  contextRecordHandle?: string
}

export interface CreateAiChatMessagePayload {
  sessionHandle?: number
  sessionTitle?: string
  content: string
  routeName?: string
  url?: string
  pageTitle?: string
  providerHandle?: string
  modelHandle?: string
  agentHandle?: string
  agentVersionHandle?: number
  playbookHandle?: string
  contextEntityHandle?: string
  contextRecordHandle?: string
  transcriptionHandle?: number
  attachmentHandles?: number[]
  contextPayload?: Record<string, unknown>
  clientCurrentDateTime?: string
  clientTimeZone?: string
  clientLocale?: string
  clientUtcOffsetMinutes?: number
}

export interface PrepareAiMarkdownPayload {
  content: string
  providerHandle?: string
  modelHandle?: string
}

export interface PrepareAiMarkdownResponse {
  content: string
}

export interface AiChatImportBatchSummary {
  handle: number | null
  status: string
  filename: string
  mimetype?: string | null
  fileSize?: number | null
  sourceHandle?: string | null
  entityHandle?: string | null
  templateHandle?: number | null
  rowCount: number
  readyCount: number
  errorCount: number
  delimiter?: string | null
  headers: string[]
  sampleRows: Record<string, unknown>[]
}

export interface AiChatAttachmentUploadResponse {
  attachment: AiChatAttachmentItem
  importBatch: AiChatImportBatchSummary
}

export interface CreateAiChatTranscriptionPayload {
  sessionHandle?: number
  providerHandle?: string
  modelHandle?: string
  language?: string
  routeName?: string
  url?: string
  pageTitle?: string
  clientCurrentDateTime?: string
  clientTimeZone?: string
  clientLocale?: string
  clientUtcOffsetMinutes?: number
  durationSeconds?: number
}

export interface CreateAiChatMessageSpeechPayload {
  providerHandle?: string
  modelHandle?: string
}

export interface AiChatTranscriptionResponse {
  transcriptionHandle: number
  transcript: string | null
  detectedLanguage: string | null
  durationSeconds: number | null
  status: string
  providerHandle: string | null
  modelHandle: string | null
  documentHandle: number | null
}

export interface VectorizeEntityPayload {
  entityHandle: string
  providerHandle: string
  modelHandle: string
}

export interface VectorizeEntityResponse {
  entityHandle: string
  providerHandle: string
  modelHandle: string
  totalSourceRecords: number
  totalDocuments: number
  embeddedDocuments: number
  skippedDocuments: number
  deletedDocuments: number
}

export interface AiChatStreamEvent {
  type: string
  session?: AiChatSessionItem
  message?: AiChatMessageItem
  action?: AiChatToolActionItem
  handle?: number
  delta?: string
  messageText?: string
}

export interface AiMcpToolDescriptor {
  serverHandle: number
  serverName: string
  toolName: string
  description?: string
  inputSchema?: Record<string, unknown> | null
}

export interface AiAgentWorkbenchResponse {
  agent: AiAgentItem
  versions: AiAgentVersionItem[]
  playbooks: AiAgentPlaybookItem[]
  memories: AiAgentMemoryItem[]
  runs: AiAgentRunItem[]
  evaluations: AiAgentEvaluationItem[]
  stats: {
    runsTotal?: number
    failedRuns?: number
    pendingActions?: number
    evaluationTotal?: number
    evaluationPassed?: number
    evaluationPassRate?: number | null
  }
}

export interface CreateAiAgentTestRunPayload {
  prompt: string
  agentVersionHandle?: number
  playbookHandle?: string
  contextEntityHandle?: string
  contextRecordHandle?: string
}

export interface CreateAiAgentEvaluationPayload {
  title: string
  prompt: string
  expectedCriteria?: string
  agentVersionHandle?: number
  targetEntityHandle?: string
  targetRecordHandle?: string
}

export interface AiChatMessageListMeta {
  limit: number
  hasMore: boolean
  nextBeforeSequence: number | null
}

export interface AiChatMessageListResponse {
  data: AiChatMessageItem[]
  meta: AiChatMessageListMeta
}
