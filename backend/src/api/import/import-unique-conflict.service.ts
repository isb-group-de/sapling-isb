import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { GenericQueryService } from '../generic/generic-query.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { ConfigureImportBatchDto } from './import.types';
import type { ImportExternalKey } from './import-reference-resolver.service';

@Injectable()
export class ImportUniqueConflictService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericQueryService: GenericQueryService,
  ) {}

  async applyStrategies(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
    dto: ConfigureImportBatchDto,
    entityHandle: string,
    row: ImportBatchRowItem,
    targetReference: string | number | null,
    externalKey: ImportExternalKey | null,
    uniqueValueClaims: Map<string, number>,
  ): Promise<void> {
    for (const field of template) {
      if (!this.isUniqueConflictField(field)) {
        continue;
      }

      const originalValue = this.normalizeScalarString(payload[field.name]);
      if (!originalValue) {
        continue;
      }

      const strategy = this.getStrategy(dto, field.name);
      const originalClaimKey = this.createClaimKey(field.name, originalValue);
      const batchConflict = uniqueValueClaims.get(originalClaimKey);
      const databaseConflict = await this.hasDatabaseConflict(
        entityHandle,
        field.name,
        originalValue,
        targetReference,
      );

      if (!batchConflict && !databaseConflict) {
        uniqueValueClaims.set(originalClaimKey, row.rowNumber);
        continue;
      }

      if (strategy !== 'appendExternalKey') {
        throw new BadRequestException(
          batchConflict
            ? this.createConflictMessage(
                'import.uniqueFieldDuplicateInBatch',
                field.name,
                originalValue,
              )
            : this.createConflictMessage(
                'import.uniqueFieldConflict',
                field.name,
                originalValue,
              ),
        );
      }

      const suffixedValue = this.appendSuffix(
        field,
        originalValue,
        this.createSuffix(row, externalKey),
      );
      const suffixedClaimKey = this.createClaimKey(field.name, suffixedValue);
      const suffixedBatchConflict = uniqueValueClaims.get(suffixedClaimKey);
      const suffixedDatabaseConflict = await this.hasDatabaseConflict(
        entityHandle,
        field.name,
        suffixedValue,
        targetReference,
      );
      if (suffixedBatchConflict || suffixedDatabaseConflict) {
        throw new BadRequestException(
          suffixedBatchConflict
            ? this.createConflictMessage(
                'import.uniqueFieldDuplicateInBatch',
                field.name,
                suffixedValue,
              )
            : this.createConflictMessage(
                'import.uniqueFieldConflict',
                field.name,
                suffixedValue,
              ),
        );
      }

      payload[field.name] = suffixedValue;
      uniqueValueClaims.set(suffixedClaimKey, row.rowNumber);
    }
  }

  private isUniqueConflictField(field: EntityTemplateDto): boolean {
    return Boolean(
      field.name &&
      field.isUnique &&
      field.name !== 'handle' &&
      !field.isReference &&
      !field.customField &&
      !field.name.startsWith('customFields.') &&
      field.isPersistent !== false &&
      ['string', 'text', 'varchar'].includes(field.type),
    );
  }

  private getStrategy(
    dto: ConfigureImportBatchDto,
    targetField: string,
  ): 'error' | 'appendExternalKey' {
    return dto.uniqueConflictStrategies?.find(
      (entry) => entry.targetField === targetField,
    )?.strategy === 'appendExternalKey'
      ? 'appendExternalKey'
      : 'error';
  }

  private async hasDatabaseConflict(
    entityHandle: string,
    targetField: string,
    value: string,
    currentReference: string | number | null,
  ): Promise<boolean> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const matches = await this.em.find(
      entityClass,
      { [targetField]: value },
      { limit: 2 },
    );
    const currentReferenceText =
      currentReference == null ? null : String(currentReference);

    return matches.some((match) => {
      const handle = this.extractResultHandle(match);
      return handle == null || String(handle) !== currentReferenceText;
    });
  }

  private createSuffix(
    row: ImportBatchRowItem,
    externalKey: ImportExternalKey | null,
  ): string {
    const externalKeySuffix = Object.values(externalKey?.parts ?? {})
      .map((value) => this.normalizeScalarString(value))
      .filter(Boolean)
      .join('-');
    return externalKeySuffix || `row-${row.rowNumber}`;
  }

  private appendSuffix(
    field: EntityTemplateDto,
    value: string,
    suffix: string,
  ): string {
    const suffixText = ` (${suffix})`;
    const maxLength =
      typeof field.length === 'number' && Number.isFinite(field.length)
        ? Math.trunc(field.length)
        : null;
    if (!maxLength || value.length + suffixText.length <= maxLength) {
      return `${value}${suffixText}`;
    }

    const prefixLength = maxLength - suffixText.length;
    return prefixLength > 0
      ? `${value.slice(0, prefixLength).trimEnd()}${suffixText}`
      : `${value}${suffixText}`.slice(0, maxLength);
  }

  private createClaimKey(fieldName: string, value: string): string {
    return `${fieldName}:${value.trim().toLocaleLowerCase()}`;
  }

  private createConflictMessage(
    key: 'import.uniqueFieldConflict' | 'import.uniqueFieldDuplicateInBatch',
    fieldName: string,
    value: string,
  ): string {
    return [key, encodeURIComponent(fieldName), encodeURIComponent(value)].join(
      ':',
    );
  }

  private normalizeScalarString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      const handle = (value as { handle?: unknown }).handle;
      if (typeof handle === 'string' || typeof handle === 'number') {
        return String(handle).trim();
      }
    }
    return '';
  }

  private extractResultHandle(value: unknown): string | number | null {
    if (!value || typeof value !== 'object') return null;
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
