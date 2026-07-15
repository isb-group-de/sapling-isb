export type AgentDraft = {
  handle: string
  title: string
  description: string | null
  icon: string | null
  color: string | null
  promptMarkdown: string
  welcomeMessage: string | null
  conversationStarters: string[]
  provider: string | null
  model: string | null
  allowedEntityHandles: string[]
  allowedKnowledgeEntityHandles: string[]
  allowedInternalTools: string[]
  allowedExternalTools: string[]
  mutationMode: string
  roles: number[]
  isActive: boolean
  isDefault: boolean
  sortOrder: number
}

export type AgentEvaluationDraft = {
  title: string
  prompt: string
  expectedCriteria: string
  agentVersionHandle: number | null
}

export type AgentSelectOption<T extends string | number | null> = {
  title: string
  value: T
}

export type AgentWorkbenchStats = Record<string, number | null | undefined>
