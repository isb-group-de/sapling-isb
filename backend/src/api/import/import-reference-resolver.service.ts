import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { createHash } from 'crypto';
import { ExternalRecordLinkItem } from '../../entity/ExternalRecordLinkItem';
import { GenericQueryService } from '../generic/generic-query.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type {
  ImportGenericReferenceMappingDto,
  ImportRelationMappingDto,
} from './import.types';

export type ImportExternalKey = {
  hash: string;
  parts: Record<string, unknown>;
};

@Injectable()
export class ImportReferenceResolverService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericQueryService: GenericQueryService,
    private readonly templateService: TemplateService,
  ) {}

  async applyRelationMappings(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
    rawData: Record<string, unknown>,
    mappings: ImportRelationMappingDto[],
  ): Promise<void> {
    for (const mapping of mappings) {
      const field = template.find(
        (entry) => entry.name === mapping.targetField,
      );
      if (!field?.isReference || !field.referenceName || field.kind !== 'm:1') {
        continue;
      }

      const sourceColumns = this.getMappingColumns(mapping);
      if (sourceColumns.length === 0) {
        continue;
      }

      switch (mapping.mode) {
        case 'externalKey':
          payload[field.name] = await this.resolveExternalReference(
            mapping.sourceHandle,
            field.referenceName,
            sourceColumns,
            rawData,
          );
          break;
        case 'value':
          payload[field.name] = await this.resolveValueReference(
            field.referenceName,
            rawData[sourceColumns[0]],
          );
          break;
        case 'handle':
        default:
          payload[field.name] = rawData[sourceColumns[0]];
          break;
      }
    }
  }

  async applyGenericReferenceMapping(
    template: EntityTemplateDto[],
    payload: Record<string, unknown>,
    rawData: Record<string, unknown>,
    mapping: ImportGenericReferenceMappingDto | null,
  ): Promise<void> {
    if (!mapping) {
      return;
    }

    const genericReferenceField = template.find(
      (field) =>
        field.genericReference?.entityField &&
        field.genericReference?.handleField,
    );
    if (!genericReferenceField?.genericReference) {
      return;
    }

    const reference = await this.resolveExternalReference(
      mapping.sourceHandle,
      mapping.entityHandle,
      mapping.keyColumns,
      rawData,
    );
    payload[genericReferenceField.genericReference.entityField] =
      mapping.entityHandle;
    payload[genericReferenceField.genericReference.handleField] = reference;
  }

  async resolveValueReference(
    entityHandle: string,
    value: unknown,
  ): Promise<string | number | null> {
    const normalizedValue = this.normalizeScalarString(value);
    if (!normalizedValue) {
      return null;
    }

    const template = this.templateService.getEntityTemplate(entityHandle);
    const valueField =
      template.find((field) => field.options?.includes('isValue')) ??
      template.find((field) => field.name === 'handle');
    if (!valueField?.name) {
      throw new BadRequestException('import.referenceValueFieldNotFound');
    }

    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const matches = await this.em.find(
      entityClass,
      { [valueField.name]: normalizedValue },
      { limit: 2 },
    );
    if (matches.length !== 1) {
      throw new NotFoundException('import.referenceValueNotUnique');
    }
    return this.extractResultHandle(matches[0]);
  }

  buildExternalKey(
    sourceHandle: string,
    entityHandle: string,
    columns: string[],
    rawData: Record<string, unknown>,
  ): ImportExternalKey {
    const normalizedColumns = this.normalizeColumns(columns);
    if (normalizedColumns.length === 0) {
      throw new BadRequestException('import.externalKeyColumnsRequired');
    }

    const parts = Object.fromEntries(
      normalizedColumns.map((column) => [
        column,
        this.normalizeScalarString(rawData[column]),
      ]),
    );
    if (Object.values(parts).some((value) => String(value).length === 0)) {
      throw new BadRequestException('import.externalKeyValueMissing');
    }

    const hashInput = JSON.stringify({ sourceHandle, entityHandle, parts });
    return {
      parts,
      hash: createHash('sha256').update(hashInput).digest('hex'),
    };
  }

  private async resolveExternalReference(
    sourceHandle: string | null | undefined,
    entityHandle: string,
    keyColumns: string[],
    rawData: Record<string, unknown>,
  ): Promise<string> {
    const normalizedSourceHandle = this.normalizeRequiredString(sourceHandle);
    const externalKey = this.buildExternalKey(
      normalizedSourceHandle,
      entityHandle,
      keyColumns,
      rawData,
    );
    const link = await this.em.findOne(ExternalRecordLinkItem, {
      source: { handle: normalizedSourceHandle },
      entity: { handle: entityHandle },
      externalKeyHash: externalKey.hash,
    });
    const resolvedLink =
      link ??
      (await this.findExternalReferenceBySingleKeyValue(
        normalizedSourceHandle,
        entityHandle,
        externalKey,
      ));
    if (!resolvedLink) {
      throw new NotFoundException('import.externalReferenceNotFound');
    }
    return resolvedLink.reference;
  }

  private async findExternalReferenceBySingleKeyValue(
    sourceHandle: string,
    entityHandle: string,
    externalKey: ImportExternalKey,
  ): Promise<ExternalRecordLinkItem | null> {
    const keyValues = Object.values(externalKey.parts)
      .map((value) => this.normalizeScalarString(value))
      .filter((value) => value.length > 0);
    if (keyValues.length !== 1 || Object.keys(externalKey.parts).length !== 1) {
      return null;
    }

    const rows = (await this.em.getConnection().execute(
      `
        select handle
        from external_record_link_item
        where source_handle = ?
          and entity_handle = ?
          and (
            select count(*)
            from jsonb_object_keys(external_key_parts)
          ) = 1
          and exists (
            select 1
            from jsonb_each_text(external_key_parts) as key_part(key, value)
            where key_part.value = ?
          )
        limit 2
      `,
      [sourceHandle, entityHandle, keyValues[0]],
    )) as Array<{ handle: number }>;
    if (rows.length > 1) {
      throw new ConflictException('import.externalReferenceNotUnique');
    }
    return rows.length === 0
      ? null
      : this.em.findOne(ExternalRecordLinkItem, { handle: rows[0].handle });
  }

  private getMappingColumns(mapping: ImportRelationMappingDto): string[] {
    return this.normalizeColumns(
      mapping.sourceColumns?.length
        ? mapping.sourceColumns
        : mapping.sourceColumn
          ? [mapping.sourceColumn]
          : [],
    );
  }

  private normalizeColumns(columns: string[]): string[] {
    return Array.from(
      new Set(columns.map((column) => column.trim()).filter(Boolean)),
    );
  }

  private normalizeRequiredString(value: unknown): string {
    const normalized = this.normalizeScalarString(value);
    if (!normalized) {
      throw new BadRequestException('global.requiredFieldMissing');
    }
    return normalized;
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
