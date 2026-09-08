import { promptText } from '../ai/prompts/ai-prompt-context';
import type { ImportTemplateSummaryDto } from './import.types';

export type ImportAiSuggestionPromptContext = {
  entityHandle: string;
  sourceHandle: string | null;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  fields: Array<Record<string, unknown>>;
  referenceCandidates: unknown[];
  templates: ImportTemplateSummaryDto[];
};

export function buildImportAiSuggestionSystemPrompt(): string {
  return [
    promptText('import.fragment1'),
    promptText('import.fragment2'),
    promptText('import.fragment3'),
    promptText('import.fragment4'),
    promptText('import.fragment5'),
    promptText('import.text1'),
    promptText('import.text2'),
    promptText('import.text3'),
  ].join('\n');
}

export function buildImportAiSuggestionUserPrompt(
  context: ImportAiSuggestionPromptContext,
): string {
  return [
    promptText('import.fragment6', { value0: context.entityHandle }),
    promptText('import.fragment7', { value0: context.sourceHandle ?? 'none' }),
    '',
    'Import context JSON:',
    JSON.stringify(
      {
        headers: context.headers,
        sampleRows: context.sampleRows,
        fields: context.fields,
        referenceCandidates: context.referenceCandidates,
        existingTemplates: context.templates.map((template) => ({
          title: template.title,
          externalKeyColumns: template.externalKeyColumns ?? [],
          genericReferenceMapping: template.genericReferenceMapping ?? null,
          mapping: template.mapping ?? null,
        })),
      },
      null,
      2,
    ),
  ].join('\n');
}
