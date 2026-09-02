import type { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import type { AiChatProgressPayload } from './ai.types';

export function buildChatUsagePayload(
  provider: string,
  model: string,
  usagePayload?: Record<string, unknown> | null,
): Record<string, unknown> {
  return { ...(usagePayload ?? {}), provider, model };
}

export function createInitialProgress(): AiChatProgressPayload {
  const now = new Date().toISOString();
  return {
    status: 'running',
    reasoningSummary: '',
    steps: [
      {
        id: `prepare-${Date.now()}`,
        kind: 'status',
        labelKey: 'aiChat.progressPreparing',
        status: 'running',
        startedAt: now,
      },
    ],
  };
}

export function getProgress(message: AiChatMessageItem): AiChatProgressPayload {
  const responsePayload = (message.responsePayload ?? {}) as Record<
    string,
    unknown
  >;
  const progress = responsePayload.progress as
    AiChatProgressPayload | undefined;
  if (progress) return progress;
  const created = createInitialProgress();
  message.responsePayload = { ...responsePayload, progress: created };
  return created;
}

export function startProgressStep(
  progress: AiChatProgressPayload,
  kind: 'status' | 'tool',
  labelKey: string,
  toolName?: string,
) {
  const current = progress.steps.find((step) => step.status === 'running');
  if (current) completeProgressStep(current);
  const step = {
    id: `${kind}-${Date.now()}-${progress.steps.length}`,
    kind,
    labelKey,
    ...(toolName ? { toolName } : {}),
    status: 'running' as const,
    startedAt: new Date().toISOString(),
  };
  progress.steps.push(step);
  return step;
}

export function getProgressToolLabelKey(toolName: string): string {
  const labelKeys: Record<string, string> = {
    current_person: 'aiChat.progressCurrentPerson',
    entity_catalog: 'aiChat.progressEntityCatalog',
    entity_schema: 'aiChat.progressEntitySchema',
    entity_search: 'aiChat.progressEntitySearch',
    generic_list: 'aiChat.progressRecordSearch',
    generic_get: 'aiChat.progressRecordDetails',
    generic_timeline: 'aiChat.progressRecordTimeline',
    web_search: 'aiChat.progressWebSearch',
    ticket_search: 'aiChat.progressTicketSearch',
    semantic_search: 'aiChat.progressSemanticSearch',
    knowledge_search: 'aiChat.progressKnowledgeSearch',
    generic_create: 'aiChat.progressCreateAction',
    generic_update: 'aiChat.progressUpdateAction',
    generic_delete: 'aiChat.progressDeleteAction',
    import_get_batch: 'aiChat.progressImportBatch',
    import_list_templates: 'aiChat.progressImportTemplates',
    import_suggest_mapping: 'aiChat.progressImportMapping',
    import_match_existing_records: 'aiChat.progressImportMatching',
    import_configure_batch: 'aiChat.progressImportConfiguration',
    import_execute_batch: 'aiChat.progressImportExecution',
  };
  return labelKeys[toolName] ?? 'aiChat.progressToolExecution';
}

export function completeProgressStep(
  step: AiChatProgressPayload['steps'][number],
): void {
  step.status = 'completed';
  step.completedAt = new Date().toISOString();
}

export function completeProgress(
  progress: AiChatProgressPayload,
  status: 'completed' | 'interrupted' | 'failed',
): void {
  for (const step of progress.steps) {
    if (step.status === 'running') {
      step.status = status;
      step.completedAt = new Date().toISOString();
    }
  }
  progress.status = status;
}
