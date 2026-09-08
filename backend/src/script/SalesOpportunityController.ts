import { promptText } from '../api/ai/prompts/ai-prompt-context';
import {
  ScriptResultClient,
  ScriptResultClientMethods,
} from './core/script.result.client.js';
import { ScriptClass } from './core/script.class.js';
import { SalesOpportunityItem } from '../entity/SalesOpportunityItem.js';
import {
  ScriptResultServer,
  ScriptResultServerMethods,
} from './core/script.result.server.js';

export class SalesOpportunityController extends ScriptClass {
  afterInsert(items: SalesOpportunityItem[]): Promise<ScriptResultServer> {
    for (const opportunity of items ?? []) {
      const year =
        opportunity.createdAt?.getFullYear() ?? new Date().getFullYear();
      opportunity.number =
        `SO-${year}-` + (opportunity.handle ?? 0).toString().padStart(5, '0');
    }

    return Promise.resolve(
      new ScriptResultServer(items, ScriptResultServerMethods.overwrite),
    );
  }

  async execute(
    items: object[],
    name: string,
    parameter?: unknown,
  ): Promise<ScriptResultClient> {
    if (name !== 'aiFindOpportunityReferences') {
      return super.execute(items, name, parameter);
    }

    void parameter;
    const item = this.requireSingleItem(items);
    const handle = this.requireHandle(item);
    return new ScriptResultClient(
      ScriptResultClientMethods.callURL,
      true,
      buildAiChatPromptUrl(
        buildSalesOpportunityPrompt(handle, item),
        'Verkaufschance mit Referenzen analysieren',
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

function buildSalesOpportunityPrompt(
  handle: string | number,
  item: Record<string, unknown>,
): string {
  const number = normalizeString(item.number);
  const title = normalizeString(item.title);
  const description = normalizeString(item.description);
  const painPoints = normalizeString(item.painPoints);

  return [
    promptText('opportunity.detail1'),
    '',
    promptText('opportunity.text1', {
      value0: number || String(handle),
      value1: title ? ` - ${title}` : '',
    }),
    description
      ? promptText('opportunity.detail2', { value0: description })
      : null,
    painPoints
      ? promptText('opportunity.detail3', { value0: painPoints })
      : null,
    '',
    'Arbeitsweise:',
    promptText('opportunity.detail4'),
    promptText('opportunity.text2', { value0: JSON.stringify(handle) }),
    promptText('opportunity.text3'),
    promptText('opportunity.text4'),
    promptText('opportunity.text5'),
    '',
    promptText('opportunity.detail5'),
    promptText('opportunity.detail6'),
    promptText('opportunity.detail7'),
    promptText('opportunity.detail8'),
    promptText('opportunity.detail9'),
    promptText('opportunity.detail10'),
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
    playbookHandle: 'salesOpportunityBriefing',
    contextEntityHandle: 'salesOpportunity',
  });

  if (handle != null) {
    params.set('contextRecordHandle', String(handle));
  }

  return `sapling-ai-chat://prompt?${params.toString()}`;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
