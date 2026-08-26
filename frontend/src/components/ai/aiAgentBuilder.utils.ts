import type {
  AiAgentItem,
  AiProviderModelItem,
  AiProviderTypeItem,
  SaplingGenericItem,
} from '@/entity/entity'
import type { AgentDraft, AgentEvaluationDraft } from './aiAgentBuilder.types'

export function createEmptyAgentDraft(): AgentDraft {
  return {
    handle: '',
    title: '',
    description: null,
    icon: 'mdi-creation',
    color: '#2563eb',
    promptMarkdown: '',
    welcomeMessage: null,
    conversationStarters: [],
    provider: null,
    model: null,
    webSearchProvider: null,
    webSearchModel: null,
    allowedEntityHandles: [],
    allowedKnowledgeEntityHandles: [],
    allowedInternalTools: [],
    allowedExternalTools: [],
    mutationMode: 'confirm',
    roles: [],
    isActive: true,
    isDefault: false,
    sortOrder: 100,
  }
}

export function createEmptyEvaluationDraft(): AgentEvaluationDraft {
  return {
    title: '',
    prompt: '',
    expectedCriteria: '',
    agentVersionHandle: null,
  }
}

export function toAgentDraft(agent: AiAgentItem): AgentDraft {
  return {
    handle: agent.handle,
    title: agent.title,
    description: agent.description ?? null,
    icon: agent.icon ?? 'mdi-creation',
    color: agent.color ?? '#2563eb',
    promptMarkdown: agent.promptMarkdown ?? '',
    welcomeMessage: agent.welcomeMessage ?? null,
    conversationStarters: agent.conversationStarters ?? [],
    provider: getProviderHandle(agent.provider),
    model: getModelHandle(agent.model),
    webSearchProvider: getProviderHandle(agent.webSearchProvider),
    webSearchModel: getModelHandle(agent.webSearchModel),
    allowedEntityHandles: agent.allowedEntityHandles ?? [],
    allowedKnowledgeEntityHandles: agent.allowedKnowledgeEntityHandles ?? [],
    allowedInternalTools: agent.allowedInternalTools ?? [],
    allowedExternalTools: agent.allowedExternalTools ?? [],
    mutationMode: agent.mutationMode || 'confirm',
    roles: normalizeRoleHandles(agent.roles),
    isActive: agent.isActive,
    isDefault: agent.isDefault,
    sortOrder: agent.sortOrder,
  }
}

export function toAgentPayload(value: AgentDraft): Partial<AiAgentItem> {
  return {
    handle: value.handle.trim(),
    title: value.title.trim(),
    description: value.description?.trim() || null,
    icon: value.icon?.trim() || null,
    color: value.color?.trim() || null,
    promptMarkdown: value.promptMarkdown.trim(),
    welcomeMessage: value.welcomeMessage?.trim() || null,
    conversationStarters: value.conversationStarters,
    provider: value.provider || null,
    model: value.model || null,
    webSearchProvider: value.webSearchProvider || null,
    webSearchModel: value.webSearchModel || null,
    allowedEntityHandles: value.allowedEntityHandles,
    allowedKnowledgeEntityHandles: value.allowedKnowledgeEntityHandles,
    allowedInternalTools: value.allowedInternalTools,
    allowedExternalTools: value.allowedExternalTools,
    mutationMode: value.mutationMode,
    roles: value.roles,
    isActive: value.isActive,
    isDefault: value.isDefault,
    sortOrder: value.sortOrder,
  }
}

export function getProviderHandle(provider?: AiProviderTypeItem | string | null): string | null {
  return provider ? (typeof provider === 'string' ? provider : (provider.handle ?? null)) : null
}

export function getModelHandle(model?: AiProviderModelItem | string | null): string | null {
  return model ? (typeof model === 'string' ? model : (model.handle ?? null)) : null
}

export function getModelProviderHandle(
  modelHandle: string | null | undefined,
  models: AiProviderModelItem[],
): string | null {
  if (!modelHandle) return null

  const model = models.find((item) => item.handle === modelHandle)
  return getProviderHandle(model?.provider)
}

export function normalizeRoleHandles(value: unknown): number[] {
  return Array.isArray(value)
    ? value
        .map((item) =>
          typeof item === 'number'
            ? item
            : item && typeof item === 'object'
              ? (item as { handle?: unknown }).handle
              : null,
        )
        .filter((handle): handle is number => typeof handle === 'number')
    : []
}

export function mapHandlesToItems<T extends SaplingGenericItem>(
  handles: Array<string | number>,
  items: T[],
): T[] {
  const handleSet = new Set(handles)
  return items.filter((item) => handleSet.has(item.handle))
}

export function getStringHandles(items: SaplingGenericItem[]): string[] {
  return items
    .map((item) => item.handle)
    .filter((handle): handle is string => typeof handle === 'string')
}

export function getNumberHandles(items: SaplingGenericItem[]): number[] {
  return items
    .map((item) => item.handle)
    .filter((handle): handle is number => typeof handle === 'number')
}
