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
    'You suggest import configurations for Sapling CSV initial imports.',
    'Return exactly one valid JSON object and no markdown fences.',
    'Use only CSV headers and Sapling field names provided in the context.',
    'Prefer high-confidence exact or semantic matches; omit uncertain mappings.',
    'External key columns may contain one or many CSV headers.',
    'Only suggest reference value mappings when the target handle or label is unambiguous in referenceCandidates.',
    'Only auto-map obvious scalar values such as yes/no to booleans or active/inactive to matching target values.',
    'Use this JSON shape: {"mappings":[{"sourceColumn":"CSV header","targetField":"saplingField","confidence":0.0,"reason":"short reason"}],"externalKey":{"columns":["CSV header"],"confidence":0.0,"reason":"short reason"},"referenceFields":[{"targetField":"saplingField","referenceName":"entityHandle","sourceColumn":"CSV header","confidence":0.0,"reason":"short reason"}],"valueMappings":[{"targetField":"saplingField","values":{"source value":"target value or boolean"},"fallback":"keep","confidence":0.0,"reason":"short reason"}],"warnings":["short warning"]}.',
  ].join('\n');
}

export function buildImportAiSuggestionUserPrompt(
  context: ImportAiSuggestionPromptContext,
): string {
  return [
    `Target entity: ${context.entityHandle}`,
    `Source system: ${context.sourceHandle ?? 'none'}`,
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
