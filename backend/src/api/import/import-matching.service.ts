import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, wrap } from '@mikro-orm/core';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { PersonItem } from '../../entity/PersonItem';
import { GenericService } from '../generic/generic.service';
import { TemplateService } from '../template/template.service';
import type {
  ImportFieldMappingDto,
  ImportMatchCandidateDto,
  ImportMatchRequestDto,
  ImportMatchResponseDto,
  ImportMatchRowDto,
} from './import.types';

export type ImportLinkedReferenceResolver = (
  row: ImportBatchRowItem,
) => Promise<string | null>;

@Injectable()
export class ImportMatchingService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericService: GenericService,
    private readonly templateService: TemplateService,
  ) {}

  async matchBatch(
    batch: ImportBatchItem,
    dto: ImportMatchRequestDto,
    currentUser: PersonItem,
    resolveLinkedReference: ImportLinkedReferenceResolver,
  ): Promise<ImportMatchResponseDto> {
    const entityHandle = this.normalizeRequiredString(dto.entityHandle);
    const sourceColumns = this.resolveSourceColumns(batch, dto.sourceColumns);
    const targetFields = this.resolveTargetFields(
      entityHandle,
      dto.targetFields,
    );
    if (targetFields.length === 0) {
      throw new BadRequestException('import.matchNoSearchableFields');
    }

    const sampleLimit = Math.min(
      Math.max(Math.trunc(dto.sampleLimit ?? 25), 1),
      100,
    );
    const limitPerValue = Math.min(
      Math.max(Math.trunc(dto.limitPerValue ?? 3), 1),
      10,
    );
    const rows = await this.em.find(
      ImportBatchRowItem,
      { batch: { handle: batch.handle } },
      { orderBy: { rowNumber: 'ASC' }, limit: sampleLimit },
    );
    const responseRows: ImportMatchRowDto[] = [];

    for (const row of rows) {
      const linkedReference = await resolveLinkedReference(row);
      if (linkedReference) {
        responseRows.push(this.createLinkedMatch(row, linkedReference));
        continue;
      }

      const candidates = await this.findCandidatesForRow(
        entityHandle,
        row,
        sourceColumns,
        targetFields,
        limitPerValue,
        currentUser,
      );
      responseRows.push(this.createCandidateMatch(row, candidates));
    }

    return {
      batchHandle: batch.handle ?? 0,
      entityHandle,
      sampledRows: rows.length,
      rows: responseRows,
    };
  }

  private createLinkedMatch(
    row: ImportBatchRowItem,
    linkedReference: string,
  ): ImportMatchRowDto {
    return {
      rowNumber: row.rowNumber,
      recommendedAction: 'update',
      confidence: 1,
      matchedReference: linkedReference,
      candidates: [
        {
          reference: linkedReference,
          displayValue: linkedReference,
          confidence: 1,
          reason: 'import.matchExternalKey',
        },
      ],
      reason: 'import.matchExternalKey',
      blockingIssues: [],
    };
  }

  private createCandidateMatch(
    row: ImportBatchRowItem,
    candidates: ImportMatchCandidateDto[],
  ): ImportMatchRowDto {
    if (candidates.length === 0) {
      return {
        rowNumber: row.rowNumber,
        recommendedAction: 'create',
        confidence: 0.7,
        matchedReference: null,
        candidates: [],
        reason: 'import.matchNoExistingRecord',
        blockingIssues: [],
      };
    }
    if (candidates.length === 1 && candidates[0].confidence >= 0.85) {
      return {
        rowNumber: row.rowNumber,
        recommendedAction: 'update',
        confidence: candidates[0].confidence,
        matchedReference: candidates[0].reference,
        candidates,
        reason: candidates[0].reason,
        blockingIssues: [],
      };
    }
    return {
      rowNumber: row.rowNumber,
      recommendedAction: 'ambiguous',
      confidence: Math.max(
        ...candidates.map((candidate) => candidate.confidence),
      ),
      matchedReference: null,
      candidates,
      reason: 'import.matchAmbiguous',
      blockingIssues: ['import.matchAmbiguous'],
    };
  }

  private resolveSourceColumns(
    batch: ImportBatchItem,
    requestedColumns: string[] | undefined,
  ): string[] {
    const headers = this.normalizeColumns(batch.headers ?? []);
    const requested = this.normalizeColumns(requestedColumns ?? []);
    if (requested.length > 0) {
      return requested.filter((column) => headers.includes(column));
    }

    const mapping = this.normalizeRecord(batch.mapping);
    const mappedColumns = this.toRecordArray<ImportFieldMappingDto>(
      mapping?.mappings,
    )
      .map((entry) => this.normalizeOptionalString(entry.sourceColumn))
      .filter((entry): entry is string => Boolean(entry));
    return mappedColumns.length > 0
      ? Array.from(new Set(mappedColumns))
      : headers;
  }

  private resolveTargetFields(
    entityHandle: string,
    requestedFields: string[] | undefined,
  ): string[] {
    const template = this.templateService.getEntityTemplate(entityHandle);
    const persistentScalarFields = template
      .filter(
        (field) =>
          Boolean(field.name) &&
          field.isPersistent !== false &&
          !['1:m', 'm:n', 'n:m', '1:1'].includes(field.kind ?? ''),
      )
      .map((field) => field.name);
    const requested = this.normalizeColumns(requestedFields ?? []);
    if (requested.length > 0) {
      return requested.filter((field) =>
        persistentScalarFields.includes(field),
      );
    }

    const preferredNames = new Set([
      'handle',
      'number',
      'externalNumber',
      'title',
      'name',
      'description',
      'email',
      'firstName',
      'lastName',
    ]);
    return template
      .filter(
        (field) =>
          field.name &&
          persistentScalarFields.includes(field.name) &&
          (field.options?.includes('isValue') ||
            preferredNames.has(field.name)),
      )
      .map((field) => field.name);
  }

  private async findCandidatesForRow(
    entityHandle: string,
    row: ImportBatchRowItem,
    sourceColumns: string[],
    targetFields: string[],
    limitPerValue: number,
    currentUser: PersonItem,
  ): Promise<ImportMatchCandidateDto[]> {
    const candidates = new Map<string, ImportMatchCandidateDto>();

    for (const sourceColumn of sourceColumns) {
      const value = this.normalizeScalarString(row.rawData[sourceColumn]);
      if (value.length < 2) {
        continue;
      }
      const result = await this.genericService.findAndCount(
        entityHandle,
        {
          $or: targetFields.map((targetField) => ({
            [targetField]: { $ilike: `%${value}%` },
          })),
        },
        1,
        limitPerValue,
        {},
        currentUser,
        [],
      );

      for (const record of result.data) {
        const reference = this.extractResultHandle(record);
        if (reference == null) {
          continue;
        }
        const key = String(reference);
        const existing = candidates.get(key);
        const confidence = this.calculateConfidence(
          record,
          targetFields,
          value,
          result.meta.total,
        );
        if (!existing || confidence > existing.confidence) {
          candidates.set(key, {
            reference: key,
            displayValue: this.buildDisplayValue(entityHandle, record),
            confidence,
            reason:
              result.meta.total === 1
                ? 'import.matchSingleValue'
                : 'import.matchCandidate',
          });
        }
      }
    }

    return [...candidates.values()]
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, limitPerValue);
  }

  private calculateConfidence(
    record: object,
    targetFields: string[],
    value: string,
    totalMatches: number,
  ): number {
    const normalizedValue = value.toLocaleLowerCase();
    const plainRecord = this.toPlainRecord(record);
    const hasExactValue = targetFields.some(
      (field) =>
        this.normalizeScalarString(plainRecord[field]).toLocaleLowerCase() ===
        normalizedValue,
    );
    if (hasExactValue && totalMatches === 1) {
      return 0.95;
    }
    if (hasExactValue) {
      return 0.8;
    }
    return totalMatches === 1 ? 0.75 : 0.45;
  }

  private buildDisplayValue(entityHandle: string, record: object): string {
    const template = this.templateService.getEntityTemplate(entityHandle);
    const plainRecord = this.toPlainRecord(record);
    const valueField =
      template.find((field) => field.options?.includes('isValue')) ??
      template.find((field) => field.name === 'title') ??
      template.find((field) => field.name === 'name') ??
      template.find((field) => field.name === 'handle');
    const value = valueField?.name
      ? this.normalizeScalarString(plainRecord[valueField.name])
      : '';
    const handle = this.extractResultHandle(record);
    return value || (handle == null ? '' : String(handle));
  }

  private normalizeColumns(columns: string[]): string[] {
    return Array.from(
      new Set(columns.map((column) => column.trim()).filter(Boolean)),
    );
  }

  private normalizeRequiredString(value: unknown): string {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      throw new BadRequestException('exception.badRequest');
    }
    return normalized;
  }

  private normalizeOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeScalarString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    return typeof value === 'number' || typeof value === 'boolean'
      ? value.toString().trim()
      : '';
  }

  private normalizeRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private toRecordArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private toPlainRecord(value: object): Record<string, unknown> {
    try {
      return wrap(value).toObject() as Record<string, unknown>;
    } catch {
      return { ...(value as Record<string, unknown>) };
    }
  }

  private extractResultHandle(value: unknown): string | number | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
