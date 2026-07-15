import type { PersonItem, RoleItem } from './entity-account.types'
import type { SaplingGenericItem } from './entity-base.types'
import type { EntityItem } from './entity-platform.types'

/**
 * Represents a persisted AI chat session.
 */
export interface AiChatSessionItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Visible title of the chat */
  title: string
  /** Archive flag */
  isArchived: boolean
  /** Preferred provider */
  provider?: AiProviderTypeItem | string | null
  /** Preferred model */
  model?: AiProviderModelItem | string | null
  /** Selected AI agent */
  agent?: AiAgentItem | string | null
  /** Fixed AI agent version for the session */
  agentVersion?: AiAgentVersionItem | number | null
  /** Selected AI playbook */
  playbook?: AiAgentPlaybookItem | string | null
  /** Optional context entity handle */
  contextEntityHandle?: string | null
  /** Optional context record handle */
  contextRecordHandle?: string | null
  /** Timestamp of the latest message */
  lastMessageAt?: Date | null
  /** Owning person */
  person: PersonItem | number
  /** Optional loaded messages */
  messages?: AiChatMessageItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a configurable AI chat agent.
 */
export interface AiAgentItem extends SaplingGenericItem {
  /** String primary key */
  handle: string
  /** Visible agent title */
  title: string
  /** Optional description */
  description?: string | null
  /** Optional icon */
  icon?: string | null
  /** Optional color */
  color?: string | null
  /** Agent-specific system prompt */
  promptMarkdown: string
  /** Optional welcome message */
  welcomeMessage?: string | null
  /** Optional starter prompts */
  conversationStarters?: string[] | null
  /** Optional provider override */
  provider?: AiProviderTypeItem | string | null
  /** Optional model override */
  model?: AiProviderModelItem | string | null
  /** Allowed Sapling entity handles */
  allowedEntityHandles?: string[] | null
  /** Allowed semantic knowledge sources */
  allowedKnowledgeEntityHandles?: string[] | null
  /** Allowed internal Sapling MCP tools */
  allowedInternalTools?: string[] | null
  /** Allowed external MCP tools */
  allowedExternalTools?: string[] | null
  /** Mutation behavior */
  mutationMode: string
  /** Roles allowed to use the agent; empty means all chat users */
  roles?: RoleItem[] | number[] | null
  /** Whether the agent is active */
  isActive: boolean
  /** Default chat agent */
  isDefault: boolean
  /** Sort order */
  sortOrder: number
  /** Active playbooks available for this agent */
  playbooks?: AiAgentPlaybookItem[] | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

export interface AiAgentVersionItem extends SaplingGenericItem {
  handle?: number | null
  agent: AiAgentItem | string
  version: number
  status: string
  promptMarkdown: string
  changelog?: string | null
  provider?: AiProviderTypeItem | string | null
  model?: AiProviderModelItem | string | null
  allowedEntityHandles?: string[] | null
  allowedKnowledgeEntityHandles?: string[] | null
  allowedInternalTools?: string[] | null
  allowedExternalTools?: string[] | null
  activatedAt?: Date | null
  createdAt?: Date | null
  updatedAt?: Date | null
}

export interface AiAgentPlaybookItem extends SaplingGenericItem {
  handle: string
  agent: AiAgentItem | string
  title: string
  description?: string | null
  triggerEntityHandles?: string[] | null
  steps: string[]
  expectedOutput?: string | null
  isActive: boolean
  sortOrder: number
  createdAt?: Date | null
  updatedAt?: Date | null
}

export interface AiAgentMemoryItem extends SaplingGenericItem {
  handle?: number | null
  agent: AiAgentItem | string
  type: string
  title: string
  contentMarkdown: string
  entityScopeHandles?: string[] | null
  roles?: RoleItem[] | number[] | null
  isActive: boolean
  sortOrder: number
  createdAt?: Date | null
  updatedAt?: Date | null
}

export interface AiAgentRunItem extends SaplingGenericItem {
  handle?: number | null
  session?: AiChatSessionItem | number | null
  message?: AiChatMessageItem | number | null
  person: PersonItem | number
  agent?: AiAgentItem | string | null
  agentVersion?: AiAgentVersionItem | number | null
  playbook?: AiAgentPlaybookItem | string | null
  status: string
  provider?: string | null
  model?: string | null
  contextEntityHandle?: string | null
  contextRecordHandle?: string | null
  durationMs?: number | null
  toolCalls?: Record<string, unknown>[] | null
  sources?: Record<string, unknown>[] | null
  pendingActions?: Record<string, unknown>[] | null
  usagePayload?: Record<string, unknown> | null
  responseText?: string | null
  errorPayload?: Record<string, unknown> | null
  startedAt?: Date | null
  completedAt?: Date | null
  updatedAt?: Date | null
}

export interface AiAgentEvaluationItem extends SaplingGenericItem {
  handle?: number | null
  agent: AiAgentItem | string
  agentVersion?: AiAgentVersionItem | number | null
  title: string
  prompt: string
  expectedCriteria?: string | null
  targetEntityHandle?: string | null
  targetRecordHandle?: string | null
  status: string
  rating?: number | null
  comment?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
}

/**
 * Represents a persisted AI chat message.
 */
export interface AiChatMessageItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Owning chat session */
  session: AiChatSessionItem | number
  /** Owning person */
  person: PersonItem | number
  /** Message role */
  role: string
  /** Message persistence or processing status */
  status: string
  /** Sequence number within the session */
  sequence: number
  /** Message content */
  content: string
  /** Optional structured context payload */
  contextPayload?: object | null
  /** Optional tool call payloads */
  toolCalls?: object[] | null
  /** Optional request payload */
  requestPayload?: object | null
  /** Optional response payload */
  responsePayload?: object | null
  /** Provider used for the message */
  provider?: string | null
  /** Model used for the message */
  model?: string | null
  /** Page URL at message creation time */
  url?: string | null
  /** Route name at message creation time */
  routeName?: string | null
  /** Page title at message creation time */
  pageTitle?: string | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a file uploaded into the AI chat.
 */
export interface AiChatAttachmentItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Owning chat session */
  session?: AiChatSessionItem | number | null
  /** Related chat message */
  message?: AiChatMessageItem | number | null
  /** Owning person */
  person: PersonItem | number
  /** Persisted document handle */
  document: number
  /** Optional import batch handle */
  importBatch?: number | null
  /** Attachment purpose */
  purpose: string
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType?: string | null
  /** File size in bytes */
  byteLength?: number | null
  /** Attachment processing status */
  status: string
  /** Structured analysis summary */
  summaryPayload?: Record<string, unknown> | null
  /** Error payload */
  errorPayload?: Record<string, unknown> | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a pending or executed AI tool action.
 */
export interface AiChatToolActionItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Owning chat session */
  session: AiChatSessionItem | number
  /** Related assistant message */
  message?: AiChatMessageItem | number | null
  /** Owning person */
  person: PersonItem | number
  /** Agent that prepared the action */
  agent?: AiAgentItem | string | null
  /** MCP server name */
  serverName: string
  /** Tool name */
  toolName: string
  /** Tool arguments */
  arguments?: Record<string, unknown> | null
  /** Action status */
  status: string
  /** Execution result payload */
  resultPayload?: Record<string, unknown> | null
  /** Execution error payload */
  errorPayload?: Record<string, unknown> | null
  /** Expiration timestamp */
  expiresAt?: Date | null
  /** Execution timestamp */
  executedAt?: Date | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Configures a generic AI action that creates one entity record from another.
 */
export interface AiEntityGenerationTemplateItem extends SaplingGenericItem {
  /** String primary key */
  handle?: string | null
  /** Visible template title */
  title: string
  /** Script button action name */
  actionName: string
  /** Source entity used by the script button */
  sourceEntity: EntityItem | string
  /** Target entity to create */
  targetEntity: EntityItem | string
  /** Relations loaded for the source prompt */
  sourceRelations?: string[] | null
  /** Template-specific generation prompt */
  promptMarkdown: string
  /** Maps generated JSON keys to target fields */
  fieldMapping?: Record<string, string> | null
  /** Maps source record paths to target fields */
  sourceFieldMapping?: Record<string, string> | null
  /** Default values applied to the target record */
  targetDefaults?: Record<string, unknown> | null
  /** Target field that receives the source handle */
  sourceReferenceField?: string | null
  /** Target field that receives the current user handle */
  userReferenceField?: string | null
  /** Optional provider override */
  provider?: AiProviderTypeItem | string | null
  /** Optional model override */
  model?: AiProviderModelItem | string | null
  /** Whether the template is active */
  isActive: boolean
  /** Optional sort order */
  sortOrder: number
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents an AI provider type.
 */
export interface AiProviderTypeItem extends SaplingGenericItem {
  /** String primary key */
  handle?: string | null
  /** Visible provider title */
  title: string
  /** Provider icon */
  icon?: string | null
  /** Provider color */
  color: string
  /** Required credential types */
  credentialTypes?: string[] | null
  /** Whether the model is active */
  isActive: boolean
  /** Optional loaded models */
  models?: AiProviderModelItem[]
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a selectable AI provider model.
 */
export interface AiProviderModelItem extends SaplingGenericItem {
  /** String primary key */
  handle?: string | null
  /** Visible model name */
  title: string
  /** Optional description */
  description?: string | null
  /** Linked provider */
  provider: AiProviderTypeItem | string
  /** Concrete provider model name */
  providerModel: string
  /** Supports streamed responses */
  supportsStreaming: boolean
  /** Supports tool usage */
  supportsTools: boolean
  /** Supports embedding generation */
  supportsEmbeddings: boolean
  /** Supports speech transcription */
  supportsTranscription: boolean
  /** Maximum texts per embedding request */
  embeddingBatchSize: number
  /** Target chunk length for vectorization */
  vectorChunkLength: number
  /** Overlap between vector chunks */
  vectorChunkOverlap: number
  /** Overfetch multiplier for vector search candidates */
  vectorSearchCandidateMultiplier: number
  /** Upper candidate limit for vector search */
  vectorSearchMaxCandidateLimit: number
  /** Maximum vector search results returned */
  vectorSearchMaxResults: number
  /** Supports speech synthesis */
  supportsSpeech: boolean
  /** Default speech voice identifier */
  speechVoice: string
  /** Default speech speed */
  speechSpeed: number
  /** Persisted speech MIME type */
  speechMimeType: string
  /** Persisted speech file extension */
  speechFileExtension: string
  /** Maximum speech input length */
  speechMaxInputLength: number
  /** Default frontend selection */
  isDefault: boolean
  /** Whether the model is active */
  isActive: boolean
  /** Optional sort order */
  sortOrder?: number | null
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a persisted MCP server configuration.
 */
export interface McpServerConfigItem extends SaplingGenericItem {
  /** Numeric primary key */
  handle?: number | null
  /** Visible server name */
  name: string
  /** Optional description */
  description?: string | null
  /** Transport type such as stdio or http */
  transport: string
  /** Whether the server is active */
  isActive: boolean
  /** HTTP endpoint for remote servers */
  endpoint?: string | null
  /** Command used for stdio servers */
  command?: string | null
  /** Process args for stdio servers */
  args?: string[] | null
  /** Environment variables */
  environment?: Record<string, string> | null
  /** Optional HTTP headers */
  headers?: Record<string, string> | null
  /** Optional auth configuration */
  authConfig?: Record<string, unknown> | null
  /** Allowed tool names */
  allowedTools?: string[] | null
  /** Per-server timeout */
  timeoutMs?: number | null
  /** Sort order */
  sortOrder: number
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}
