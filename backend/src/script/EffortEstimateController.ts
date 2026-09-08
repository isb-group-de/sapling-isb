import { promptText } from '../api/ai/prompts/ai-prompt-context';
import {
  ScriptResultClient,
  ScriptResultClientMethods,
} from './core/script.result.client.js';
import { ScriptClass } from './core/script.class.js';

export class EffortEstimateController extends ScriptClass {
  async execute(
    items: object[],
    name: string,
    parameter?: unknown,
  ): Promise<ScriptResultClient> {
    if (name !== 'aiSuggestSimilarEstimates') {
      return super.execute(items, name, parameter);
    }

    void parameter;
    const item = this.requireSingleItem(items);
    const handle = this.requireHandle(item);
    return new ScriptResultClient(
      ScriptResultClientMethods.callURL,
      true,
      buildAiChatPromptUrl(
        buildEffortEstimatePrompt(handle, item),
        'Aufwandsschätzung analysieren',
        handle,
      ),
    );
  }

  private requireSingleItem(items: object[]): Record<string, unknown> {
    const item = items[0];

    if (items.length !== 1 || !item || typeof item !== 'object') {
      throw new Error('script.singleSelectionRequired');
    }

    return item as Record<string, unknown>;
  }

  private requireHandle(item: Record<string, unknown>): string | number {
    const handle = item.handle;

    if (
      (typeof handle === 'string' && handle.trim()) ||
      (typeof handle === 'number' && Number.isFinite(handle))
    ) {
      return handle;
    }

    throw new Error('global.invalidPayload');
  }
}

function buildEffortEstimatePrompt(
  handle: string | number,
  item: Record<string, unknown>,
): string {
  const title = normalizeString(item.title);
  const requirements = normalizeString(item.requirementsMarkdown);

  return [
    promptText('estimate.detail1'),
    '',
    promptText('estimate.detail2', {
      value0: String(handle),
      value1: title ? ` - ${title}` : '',
    }),
    requirements
      ? promptText('estimate.detail3', { value0: requirements })
      : null,
    '',
    'Arbeitsweise:',
    promptText('estimate.detail4'),
    promptText('estimate.text1', { value0: JSON.stringify(handle) }),
    promptText('estimate.text2'),
    promptText('estimate.text3'),
    promptText('estimate.text4'),
    '',
    promptText('estimate.detail5'),
    promptText('estimate.detail6'),
    promptText('estimate.detail7'),
    promptText('estimate.detail8'),
    promptText('estimate.detail9'),
    promptText('estimate.detail10'),
  ]
    .filter(
      (line): line is string => typeof line === 'string' && line.length > 0,
    )
    .join('\n');
}

function buildAiChatPromptUrl(
  prompt: string,
  title: string,
  handle?: string | number,
): string {
  const params = new URLSearchParams({
    prompt,
    title,
    autoSend: 'true',
    newChat: 'true',
    agentHandle: 'salesOpportunityAgent',
    playbookHandle: 'salesEstimatePreparation',
    contextEntityHandle: 'effortEstimate',
  });

  if (handle != null) {
    params.set('contextRecordHandle', String(handle));
  }

  return `sapling-ai-chat://prompt?${params.toString()}`;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
