import { describe, expect, it } from '@jest/globals';
import type { ImportAiSuggestionDto } from './import.types';
import { ImportAiSuggestionService } from './import-ai-suggestion.service';
import {
  buildImportAiSuggestionSystemPrompt,
  buildImportAiSuggestionUserPrompt,
} from './import-ai-suggestion.prompts';

function createService(): ImportAiSuggestionService {
  return new ImportAiSuggestionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('ImportAiSuggestionService', () => {
  it('keeps only suggestions that belong to the provided import context', () => {
    const service = createService();
    const result = (
      service as unknown as {
        normalizeSuggestion(
          raw: Record<string, unknown>,
          context: Record<string, unknown>,
        ): ImportAiSuggestionDto;
      }
    ).normalizeSuggestion(
      {
        mappings: [
          {
            sourceColumn: 'Company name',
            targetField: 'name',
            confidence: 2,
          },
          { sourceColumn: 'Unknown', targetField: 'status' },
          { sourceColumn: 'Status', targetField: 'missingField' },
        ],
        externalKey: { columns: ['External ID', 'Unknown'], confidence: -1 },
        warnings: [' Check mapping ', '', 42],
      },
      {
        entityHandle: 'company',
        sourceHandle: null,
        headers: ['Company name', 'Status', 'External ID'],
        sampleRows: [],
        fields: [{ name: 'name' }, { name: 'status' }],
        referenceCandidates: [],
        templates: [],
      },
    );

    expect(result.mappings).toEqual([
      expect.objectContaining({
        sourceColumn: 'Company name',
        targetField: 'name',
        confidence: 1,
      }),
    ]);
    expect(result.externalKey).toEqual(
      expect.objectContaining({ columns: ['External ID'], confidence: 0 }),
    );
    expect(result.warnings).toEqual(['Check mapping']);
  });

  it('builds a constrained prompt with the provided context', () => {
    const context = {
      entityHandle: 'company',
      sourceHandle: 'erp',
      headers: ['Name'],
      sampleRows: [{ Name: 'Sapling' }],
      fields: [{ name: 'name' }],
      referenceCandidates: [],
      templates: [],
    };

    expect(buildImportAiSuggestionSystemPrompt()).toContain(
      'Return exactly one valid JSON object',
    );
    expect(buildImportAiSuggestionUserPrompt(context)).toContain(
      'Target entity: company',
    );
  });
});
