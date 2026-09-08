import { promptText } from '../api/ai/prompts/ai-prompt-context';
import {
  ScriptResultClient,
  ScriptResultClientMethods,
} from './core/script.result.client.js';
import { ScriptClass } from './core/script.class.js';

export class DvelopEntityMappingController extends ScriptClass {
  async execute(
    items: object[],
    name: string,
    parameter?: unknown,
  ): Promise<ScriptResultClient> {
    if (name !== 'aiCreatePropertyMappings') {
      return super.execute(items, name, parameter);
    }

    void parameter;
    const item = this.requireSingleItem(items);
    const handle = this.requireHandle(item);

    return new ScriptResultClient(
      ScriptResultClientMethods.callURL,
      true,
      buildAiChatPromptUrl(
        buildPropertyMappingPrompt(handle, item),
        'd.velop Cloud-Eigenschaftszuordnung erstellen',
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

function buildPropertyMappingPrompt(
  handle: string | number,
  item: Record<string, unknown>,
): string {
  const entityLabel = normalizeReferenceLabel(item.entity);
  const connectionLabel = normalizeReferenceLabel(item.connection);
  const objectDefinitionLabel = normalizeReferenceLabel(item.objectDefinition);

  return [
    promptText('dvelop.text1'),
    '',
    promptText('dvelop.detail1', { value0: String(handle) }),
    entityLabel ? promptText('dvelop.detail2', { value0: entityLabel }) : null,
    connectionLabel
      ? promptText('dvelop.detail3', { value0: connectionLabel })
      : null,
    objectDefinitionLabel
      ? promptText('dvelop.detail4', { value0: objectDefinitionLabel })
      : null,
    '',
    'Arbeitsweise:',
    promptText('dvelop.detail5'),
    promptText('dvelop.text2', { value0: JSON.stringify(handle) }),
    promptText('dvelop.text3'),
    promptText('dvelop.text4'),
    promptText('dvelop.text5'),
    promptText('dvelop.text6'),
    promptText('dvelop.text7'),
    '',
    'Matching-Regeln:',
    promptText('dvelop.text8'),
    promptText('dvelop.text9'),
    promptText('dvelop.text10'),
    promptText('dvelop.text11'),
    promptText('dvelop.text12'),
    promptText('dvelop.text13'),
    promptText('dvelop.text14'),
    promptText('dvelop.text15'),
    promptText('dvelop.text16'),
    promptText('dvelop.text17'),
    promptText('dvelop.detail6'),
    promptText('dvelop.detail7'),
    '',
    promptText('dvelop.detail8'),
    promptText('dvelop.text18'),
    promptText('dvelop.detail9'),
    promptText('dvelop.detail10'),
    '',
    promptText('dvelop.text19'),
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
    agentHandle: 'songbirdGeneral',
    contextEntityHandle: 'dvelopEntityMapping',
  });

  if (handle != null) {
    params.set('contextRecordHandle', String(handle));
  }

  return `sapling-ai-chat://prompt?${params.toString()}`;
}

function normalizeReferenceLabel(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;

  return [record.handle, record.title, record.name]
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .map(String)
    .join(' - ');
}
