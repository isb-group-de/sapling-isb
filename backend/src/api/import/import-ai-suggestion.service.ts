import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, wrap } from '@mikro-orm/core';
import { AiProviderRegistryService } from '../ai/ai-provider-registry.service';
import { createGeminiClient } from '../ai/gemini-ai.runtime';
import { createOpenAiClient } from '../ai/openai-ai.runtime';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import { GenericQueryService } from '../generic/generic-query.service';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { TemplateService } from '../template/template.service';
import { FieldPermissionService } from '../current/field-permission.service';
import { GenericService } from '../generic/generic.service';
import type { PersonItem } from '../../entity/PersonItem';
import {
  buildImportAiSuggestionSystemPrompt,
  buildImportAiSuggestionUserPrompt,
} from './import-ai-suggestion.prompts';
import type {
  ImportAiSuggestDto,
  ImportAiSuggestedExternalKeyDto,
  ImportAiSuggestedFieldMappingDto,
  ImportAiSuggestedReferenceFieldDto,
  ImportAiSuggestedValueMappingDto,
  ImportAiSuggestionDto,
  ImportTemplateSummaryDto,
  ImportValueMappingFallback,
} from './import.types';

const SAMPLE_ROW_LIMIT = 5;
const AI_REFERENCE_CANDIDATE_LIMIT = 50;
const AI_TEMPLATE_CONTEXT_LIMIT = 5;

type ImportReferenceCandidate = {
  targetField: string;
  referenceName: string;
  values: Array<{
    handle: string | number;
    label: string;
  }>;
};

type ImportAiSuggestionContext = {
  entityHandle: string;
  sourceHandle: string | null;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  fields: Array<Record<string, unknown>>;
  referenceCandidates: ImportReferenceCandidate[];
  templates: ImportTemplateSummaryDto[];
};

type ImportAiSuggestionRaw = {
  mappings?: unknown;
  externalKey?: unknown;
  keyColumns?: unknown;
  referenceFields?: unknown;
  valueMappings?: unknown;
  warnings?: unknown;
};

export type ImportAiSuggestionRequest = {
  entityHandle: string;
  sourceHandle: string | null;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  templates: ImportTemplateSummaryDto[];
  currentUser: PersonItem;
};

@Injectable()
export class ImportAiSuggestionService {
  constructor(
    private readonly em: EntityManager,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly genericQueryService: GenericQueryService,
    private readonly templateService: TemplateService,
    private readonly genericCustomFieldService: GenericCustomFieldService,
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      applyTemplateAccess: (
        _user: PersonItem,
        _entityHandle: string,
        templates: EntityTemplateDto[],
      ): EntityTemplateDto[] => templates,
    } as unknown as FieldPermissionService,
    private readonly genericService: GenericService = {
      findAndCount: () =>
        Promise.resolve({
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit: 0,
            totalPages: 0,
            executionTime: 0,
          },
        }),
    } as unknown as GenericService,
  ) {}

  async suggestConfiguration(
    request: ImportAiSuggestionRequest,
    dto: ImportAiSuggestDto,
  ): Promise<ImportAiSuggestionDto> {
    const template = this.fieldPermissions.applyTemplateAccess(
      request.currentUser,
      request.entityHandle,
      await this.fieldPermissions.getTemplates(request.entityHandle),
    );
    const importableFields = this.getImportableFields(template);
    const context: ImportAiSuggestionContext = {
      entityHandle: request.entityHandle,
      sourceHandle: request.sourceHandle,
      headers: request.headers,
      sampleRows: this.limitSampleRows(request.sampleRows, dto.maxSampleRows),
      fields: importableFields.map((field) => ({
        name: field.name,
        type: field.type,
        kind: field.kind ?? null,
        isRequired: field.isRequired,
        isReference: field.isReference,
        referenceName: field.referenceName || null,
        options: field.options ?? [],
        genericReference: field.genericReference ?? null,
      })),
      referenceCandidates: await this.buildImportReferenceCandidates(
        importableFields,
        request.currentUser,
      ),
      templates: request.templates.slice(0, AI_TEMPLATE_CONTEXT_LIMIT),
    };
    const generation = await this.generateSuggestion(context, dto);

    return {
      ...this.normalizeSuggestion(generation.raw, context),
      providerHandle: generation.providerHandle,
      modelHandle: generation.modelHandle,
    };
  }

  private async generateSuggestion(
    context: ImportAiSuggestionContext,
    dto: ImportAiSuggestDto,
  ): Promise<{
    raw: ImportAiSuggestionRaw;
    providerHandle: string | null;
    modelHandle: string | null;
  }> {
    const runtimeTarget = await this.providerRegistry.resolveRuntimeTarget(
      dto.providerHandle ?? null,
      dto.modelHandle ?? null,
    );
    const systemPrompt = buildImportAiSuggestionSystemPrompt();
    const userPrompt = buildImportAiSuggestionUserPrompt(context);
    const rawText =
      runtimeTarget.providerKind === 'gemini'
        ? await this.generateGeminiText(
            runtimeTarget.provider,
            runtimeTarget.model.providerModel,
            systemPrompt,
            userPrompt,
          )
        : await this.generateOpenAiText(
            runtimeTarget.provider,
            runtimeTarget.model.providerModel,
            systemPrompt,
            userPrompt,
          );

    return {
      raw: this.parseJsonObject(rawText),
      providerHandle: runtimeTarget.provider.handle ?? null,
      modelHandle: runtimeTarget.model.handle ?? null,
    };
  }

  private async generateOpenAiText(
    provider: Parameters<typeof createOpenAiClient>[0],
    model: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const response = await createOpenAiClient(provider).chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
    );

    return response.choices[0]?.message?.content ?? '';
  }

  private async generateGeminiText(
    provider: Parameters<typeof createGeminiClient>[0],
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const model = createGeminiClient(provider).getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);

    return result.response.text();
  }

  private normalizeSuggestion(
    rawSuggestion: ImportAiSuggestionRaw,
    context: ImportAiSuggestionContext,
  ): ImportAiSuggestionDto {
    const headerSet = new Set(context.headers);
    const fieldSet = new Set(context.fields.map((field) => String(field.name)));
    const referenceFieldMap = new Map(
      context.referenceCandidates.map((candidate) => [
        candidate.targetField,
        candidate,
      ]),
    );
    const mappings: ImportAiSuggestedFieldMappingDto[] = [];
    const mappedTargets = new Set<string>();

    for (const entry of this.toRecordArray(rawSuggestion.mappings)) {
      const sourceColumn = this.normalizeOptionalString(entry.sourceColumn);
      const targetField = this.normalizeOptionalString(entry.targetField);
      if (
        !sourceColumn ||
        !targetField ||
        !headerSet.has(sourceColumn) ||
        !fieldSet.has(targetField) ||
        mappedTargets.has(targetField)
      ) {
        continue;
      }

      mappings.push({
        sourceColumn,
        targetField,
        confidence: this.normalizeConfidence(entry.confidence),
        reason: this.normalizeOptionalString(entry.reason),
      });
      mappedTargets.add(targetField);
    }

    const externalKey = this.normalizeSuggestedExternalKey(
      rawSuggestion.externalKey ?? rawSuggestion.keyColumns,
      context.headers,
    );
    const referenceFields = this.normalizeSuggestedReferenceFields(
      rawSuggestion.referenceFields,
      headerSet,
      referenceFieldMap,
    );
    const valueMappings = this.normalizeSuggestedValueMappings(
      rawSuggestion.valueMappings,
      mappings,
      referenceFieldMap,
    );

    return {
      mappings,
      externalKey,
      referenceFields,
      valueMappings,
      warnings: this.toStringArray(rawSuggestion.warnings).slice(0, 8),
    };
  }

  private normalizeSuggestedExternalKey(
    value: unknown,
    headers: string[],
  ): ImportAiSuggestedExternalKeyDto | null {
    const headerSet = new Set(headers);
    const record = this.normalizeRecord(value);
    const rawColumns = record
      ? record.columns
      : Array.isArray(value)
        ? value
        : null;
    const columns = this.normalizeColumns(
      this.toStringArray(rawColumns).filter((column) => headerSet.has(column)),
    );

    if (columns.length === 0) {
      return null;
    }

    return {
      columns,
      confidence: this.normalizeConfidence(record?.confidence),
      reason: this.normalizeOptionalString(record?.reason),
    };
  }

  private normalizeSuggestedReferenceFields(
    value: unknown,
    headerSet: Set<string>,
    referenceFieldMap: Map<string, ImportReferenceCandidate>,
  ): ImportAiSuggestedReferenceFieldDto[] {
    const referenceFields: ImportAiSuggestedReferenceFieldDto[] = [];

    for (const entry of this.toRecordArray(value)) {
      const targetField = this.normalizeOptionalString(entry.targetField);
      if (!targetField || !referenceFieldMap.has(targetField)) {
        continue;
      }

      const candidate = referenceFieldMap.get(targetField);
      const sourceColumn = this.normalizeOptionalString(entry.sourceColumn);
      referenceFields.push({
        targetField,
        referenceName:
          this.normalizeOptionalString(entry.referenceName) ??
          candidate?.referenceName ??
          '',
        sourceColumn:
          sourceColumn && headerSet.has(sourceColumn) ? sourceColumn : null,
        confidence: this.normalizeConfidence(entry.confidence),
        reason: this.normalizeOptionalString(entry.reason),
      });
    }

    return referenceFields;
  }

  private normalizeSuggestedValueMappings(
    value: unknown,
    mappings: ImportAiSuggestedFieldMappingDto[],
    referenceFieldMap: Map<string, ImportReferenceCandidate>,
  ): ImportAiSuggestedValueMappingDto[] {
    const mappedTargets = new Set(
      mappings.map((mapping) => mapping.targetField),
    );
    const valueMappings: ImportAiSuggestedValueMappingDto[] = [];

    for (const entry of this.toRecordArray(value)) {
      const targetField = this.normalizeOptionalString(entry.targetField);
      const rawValues = this.normalizeRecord(entry.values);
      if (!targetField || !rawValues || !mappedTargets.has(targetField)) {
        continue;
      }

      const referenceCandidate = referenceFieldMap.get(targetField);
      const referenceValueLookup = referenceCandidate
        ? this.buildReferenceValueLookup(referenceCandidate)
        : null;
      const normalizedValues = Object.fromEntries(
        Object.entries(rawValues)
          .map(([sourceValue, targetValue]) => {
            const sourceKey = this.normalizeScalarString(sourceValue);
            const normalizedTarget = this.normalizeSuggestedValueMappingTarget(
              targetValue,
              referenceValueLookup,
            );

            return [sourceKey, normalizedTarget] as const;
          })
          .filter(
            (entry): entry is readonly [string, string | number | boolean] =>
              entry[0].length > 0 && typeof entry[1] !== 'undefined',
          ),
      );

      if (Object.keys(normalizedValues).length === 0) {
        continue;
      }

      valueMappings.push({
        targetField,
        values: normalizedValues,
        fallback: this.normalizeValueMappingFallback(
          entry.fallback as ImportValueMappingFallback,
        ),
        confidence: this.normalizeConfidence(entry.confidence),
        reason: this.normalizeOptionalString(entry.reason),
      });
    }

    return valueMappings;
  }

  private normalizeSuggestedValueMappingTarget(
    value: unknown,
    referenceValueLookup: Map<string, string | number> | null,
  ): string | number | boolean | undefined {
    if (value == null || typeof value === 'undefined') {
      return undefined;
    }

    if (referenceValueLookup) {
      const normalized = this.normalizeScalarString(value);
      return normalized ? referenceValueLookup.get(normalized) : undefined;
    }

    return typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
      ? value
      : undefined;
  }

  private buildReferenceValueLookup(
    candidate: ImportReferenceCandidate,
  ): Map<string, string | number> {
    const lookup = new Map<string, string | number>();
    const duplicateLabels = new Set<string>();

    for (const value of candidate.values) {
      lookup.set(String(value.handle), value.handle);
      const label = value.label.trim();
      if (!label) {
        continue;
      }
      if (lookup.has(label)) {
        duplicateLabels.add(label);
      } else {
        lookup.set(label, value.handle);
      }
    }

    duplicateLabels.forEach((label) => lookup.delete(label));
    return lookup;
  }

  private async buildImportReferenceCandidates(
    fields: EntityTemplateDto[],
    currentUser: PersonItem,
  ): Promise<ImportReferenceCandidate[]> {
    const candidates: ImportReferenceCandidate[] = [];

    for (const field of fields) {
      if (!field.isReference || !field.referenceName || field.kind !== 'm:1') {
        continue;
      }

      const referenceTemplate = this.fieldPermissions
        .applyTemplateAccess(
          currentUser,
          field.referenceName,
          await this.fieldPermissions.getTemplates(field.referenceName),
        )
        .filter((entry) => entry.fieldAccess?.allowRead !== false);
      const handleField = referenceTemplate.find(
        (entry) => entry.name === 'handle',
      );
      const valueField =
        referenceTemplate.find((entry) => entry.options?.includes('isValue')) ??
        handleField;
      if (!handleField || !valueField) continue;
      const result = await this.genericService.findAndCount(
        field.referenceName,
        {},
        1,
        AI_REFERENCE_CANDIDATE_LIMIT,
        { handle: 'ASC' },
        currentUser,
        [],
        [...new Set(['handle', valueField.name])],
      );

      candidates.push({
        targetField: field.name,
        referenceName: field.referenceName,
        values: result.data
          .map((record) => this.toPlainRecord(record))
          .map((record) => ({
            handle: record.handle,
            label: String(
              record[valueField?.name ?? 'handle'] ?? record.handle,
            ),
          }))
          .filter(
            (record): record is { handle: string | number; label: string } =>
              typeof record.handle === 'string' ||
              typeof record.handle === 'number',
          ),
      });
    }

    return candidates;
  }

  private getImportableFields(
    template: EntityTemplateDto[],
  ): EntityTemplateDto[] {
    return template.filter((field) => {
      if (!field.name) {
        return false;
      }
      if (field.name === 'handle') {
        return !(
          field.fieldAccess?.allowInsert === false &&
          field.fieldAccess?.allowUpdate === false
        );
      }
      if (
        field.isPersistent === false ||
        field.options?.includes('isReadOnly') ||
        field.options?.includes('isSecurity')
      ) {
        return false;
      }
      if (
        field.fieldAccess?.allowInsert === false &&
        field.fieldAccess?.allowUpdate === false
      ) {
        return false;
      }
      return !['1:m', 'm:n', 'n:m', '1:1'].includes(field.kind ?? '');
    });
  }

  private limitSampleRows(
    rows: Record<string, unknown>[],
    maxSampleRows?: number | null,
  ): Record<string, unknown>[] {
    const limit =
      Number.isFinite(maxSampleRows) && (maxSampleRows ?? 0) > 0
        ? Math.min(8, Math.trunc(maxSampleRows ?? SAMPLE_ROW_LIMIT))
        : SAMPLE_ROW_LIMIT;

    return rows.slice(0, limit).map((row) => ({ ...row }));
  }

  private parseJsonObject(rawText: string): Record<string, unknown> {
    const text = rawText
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '');
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new BadRequestException('import.aiInvalidJsonResponse');
    }

    try {
      const parsed: unknown = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('import.aiInvalidJsonResponse');
    }
  }

  private normalizeConfidence(value: unknown): number {
    const confidence = Number(value);
    return Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0.5;
  }

  private toRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === 'object' && !Array.isArray(entry),
        )
      : [];
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean)
      : [];
  }

  private normalizeRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private normalizeColumns(columns: string[]): string[] {
    return Array.from(
      new Set(columns.map((column) => column.trim()).filter(Boolean)),
    );
  }

  private normalizeOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private normalizeScalarString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    return typeof value === 'number' || typeof value === 'boolean'
      ? value.toString().trim()
      : '';
  }

  private normalizeValueMappingFallback(
    fallback: ImportValueMappingFallback | undefined,
  ): ImportValueMappingFallback {
    return fallback === 'empty' || fallback === 'error' ? fallback : 'keep';
  }

  private toPlainRecord(value: object): Record<string, unknown> {
    try {
      return wrap(value).toObject() as Record<string, unknown>;
    } catch {
      return { ...(value as Record<string, unknown>) };
    }
  }
}
