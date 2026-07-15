import { BadRequestException, Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import { normalizeImportRow } from '../generic/generic-import.util';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { ImportFieldValidationService } from './import-field-validation.service';
import { ImportReferenceResolverService } from './import-reference-resolver.service';
import type {
  ConfigureImportBatchDto,
  ImportValueMappingDto,
  ImportValueMappingFallback,
} from './import.types';

@Injectable()
export class ImportPayloadService {
  constructor(
    private readonly referenceResolver: ImportReferenceResolverService,
    private readonly fieldValidationService: ImportFieldValidationService,
    private readonly genericCustomFieldService: GenericCustomFieldService,
  ) {}

  async buildPayload(
    template: EntityTemplateDto[],
    rawData: Record<string, unknown>,
    dto: ConfigureImportBatchDto,
    currentUser: PersonItem,
  ): Promise<Record<string, unknown>> {
    const mapped: Record<string, unknown> = {};
    for (const mapping of dto.mappings ?? []) {
      const sourceColumn = this.normalizeOptionalString(mapping.sourceColumn);
      const targetField = this.normalizeOptionalString(mapping.targetField);
      if (!sourceColumn || !targetField) {
        continue;
      }
      mapped[targetField] = await this.applyValueMapping(
        template,
        targetField,
        rawData[sourceColumn] ?? '',
        dto.valueMappings ?? [],
      );
    }

    const payload = normalizeImportRow(template, mapped);
    await this.referenceResolver.applyRelationMappings(
      template,
      payload,
      rawData,
      dto.relationMappings ?? [],
    );
    this.fieldValidationService.applyDefaults(
      template,
      payload,
      dto.fieldDefaults ?? [],
      currentUser,
    );
    await this.referenceResolver.applyGenericReferenceMapping(
      template,
      payload,
      rawData,
      dto.genericReferenceMapping ?? null,
    );
    this.genericCustomFieldService.collectCustomFieldsFromFlatPayload(payload);
    return payload;
  }

  async applyValueMapping(
    template: EntityTemplateDto[],
    targetField: string,
    value: unknown,
    mappings: ImportValueMappingDto[],
  ): Promise<unknown> {
    const mapping = mappings.find((entry) => entry.targetField === targetField);
    if (!mapping) {
      return value;
    }

    const sourceKey = this.normalizeScalarString(value);
    if (!sourceKey) {
      return value;
    }
    if (Object.prototype.hasOwnProperty.call(mapping.values, sourceKey)) {
      return mapping.values[sourceKey];
    }

    switch (this.normalizeValueMappingFallback(mapping.fallback)) {
      case 'empty':
        return '';
      case 'error':
        throw new BadRequestException(
          this.createValueMappingMissingMessage(targetField, sourceKey),
        );
      case 'keep':
      default:
        return this.resolveKeptOriginalValue(template, targetField, value);
    }
  }

  private async resolveKeptOriginalValue(
    template: EntityTemplateDto[],
    targetField: string,
    value: unknown,
  ): Promise<unknown> {
    const field = template.find((entry) => entry.name === targetField);
    if (!field?.isReference || !field.referenceName || field.kind !== 'm:1') {
      return value;
    }

    try {
      return await this.referenceResolver.resolveValueReference(
        field.referenceName,
        value,
      );
    } catch {
      throw new BadRequestException(
        this.createValueMappingMissingMessage(
          targetField,
          this.normalizeScalarString(value),
        ),
      );
    }
  }

  private createValueMappingMissingMessage(
    targetField: string,
    sourceValue: string,
  ): string {
    return [
      'import.valueMappingMissing',
      encodeURIComponent(targetField.trim()),
      encodeURIComponent(sourceValue.trim()),
    ].join(':');
  }

  private normalizeValueMappingFallback(
    fallback: ImportValueMappingFallback | undefined,
  ): ImportValueMappingFallback {
    return fallback === 'empty' || fallback === 'error' ? fallback : 'keep';
  }

  private normalizeOptionalString(value: unknown): string | null {
    const normalized = this.normalizeScalarString(value);
    return normalized || null;
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
}
