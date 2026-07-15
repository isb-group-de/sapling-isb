import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { ImportSourceItem } from '../../entity/ImportSourceItem';
import { ImportTemplateItem } from '../../entity/ImportTemplateItem';
import { ImportTemplateValueMappingItem } from '../../entity/ImportTemplateValueMappingItem';
import type {
  ImportTemplateSummaryDto,
  ImportValueMappingDto,
  ImportValueMappingFallback,
  SaveImportTemplateDto,
} from './import.types';

@Injectable()
export class ImportTemplateService {
  constructor(private readonly em: EntityManager) {}

  async listTemplates(
    entityHandle?: string,
    sourceHandle?: string,
  ): Promise<ImportTemplateSummaryDto[]> {
    const filter: Record<string, unknown> = { isActive: true };
    const normalizedEntityHandle = this.normalizeOptionalString(entityHandle);
    const normalizedSourceHandle = this.normalizeOptionalString(sourceHandle);

    if (normalizedEntityHandle) {
      filter.targetEntity = { handle: normalizedEntityHandle };
    }
    if (normalizedSourceHandle) {
      filter.source = { handle: normalizedSourceHandle };
    }

    const templates = await this.em.find(ImportTemplateItem, filter, {
      populate: ['source', 'targetEntity', 'valueMappings'],
      orderBy: { title: 'ASC' },
    });
    return templates.map((template) => this.toTemplateSummary(template));
  }

  async createTemplate(
    dto: SaveImportTemplateDto,
  ): Promise<ImportTemplateSummaryDto> {
    if (dto.handle != null) {
      throw new BadRequestException('exception.badRequest');
    }
    return this.saveTemplate(dto, null);
  }

  async updateTemplate(
    handle: number,
    dto: SaveImportTemplateDto,
  ): Promise<ImportTemplateSummaryDto> {
    if (!Number.isFinite(handle)) {
      throw new BadRequestException('exception.badRequest');
    }
    return this.saveTemplate(dto, Math.trunc(handle));
  }

  mergeValueMappings(
    baseMappings: ImportValueMappingDto[],
    overrideMappings: ImportValueMappingDto[],
  ): ImportValueMappingDto[] {
    const merged = new Map<string, ImportValueMappingDto>();

    for (const mapping of this.normalizeValueMappings(baseMappings)) {
      merged.set(mapping.targetField, {
        targetField: mapping.targetField,
        values: { ...mapping.values },
        fallback: mapping.fallback,
      });
    }
    for (const mapping of this.normalizeValueMappings(overrideMappings)) {
      const existing = merged.get(mapping.targetField);
      merged.set(mapping.targetField, {
        targetField: mapping.targetField,
        values: { ...(existing?.values ?? {}), ...mapping.values },
        fallback: mapping.fallback ?? existing?.fallback,
      });
    }

    return [...merged.values()];
  }

  getConfiguredValueMappings(
    template: ImportTemplateItem,
  ): ImportValueMappingDto[] {
    const entityMappings = this.getTemplateEntityValueMappings(template);
    if (entityMappings.length > 0) {
      return entityMappings;
    }

    const mapping = template.mapping as { valueMappings?: unknown };
    return Array.isArray(mapping?.valueMappings)
      ? this.normalizeValueMappings(
          mapping.valueMappings as ImportValueMappingDto[],
        )
      : [];
  }

  private async saveTemplate(
    dto: SaveImportTemplateDto,
    handle: number | null,
  ): Promise<ImportTemplateSummaryDto> {
    const title = this.normalizeRequiredString(dto.title);
    const entityHandle = this.normalizeRequiredString(dto.entityHandle);
    const sourceHandle = this.normalizeRequiredString(dto.sourceHandle);
    const targetEntity = await this.em.findOne(EntityItem, {
      handle: entityHandle,
    });
    const source = await this.em.findOne(ImportSourceItem, {
      handle: sourceHandle,
    });

    if (!targetEntity) {
      throw new NotFoundException('global.entityNotFound');
    }
    if (!source) {
      throw new NotFoundException('import.sourceNotFound');
    }

    const existingByTitle = await this.em.findOne(ImportTemplateItem, {
      source: { handle: sourceHandle },
      targetEntity: { handle: entityHandle },
      title,
    });
    if (
      existingByTitle &&
      (handle == null || existingByTitle.handle !== handle)
    ) {
      throw new ConflictException('import.templateAlreadyExists');
    }

    const template = handle
      ? await this.em.findOne(
          ImportTemplateItem,
          { handle },
          { populate: ['source', 'targetEntity', 'valueMappings'] },
        )
      : new ImportTemplateItem();
    if (!template) {
      throw new NotFoundException('import.templateNotFound');
    }

    if (!handle) {
      await this.resetSerialSequence('import_template_item');
      this.em.persist(template);
    }

    template.title = title;
    template.description =
      this.normalizeOptionalString(dto.description) ?? undefined;
    template.source = source;
    template.targetEntity = targetEntity;
    template.isActive = dto.isActive ?? true;
    template.mapping = {
      mappings: dto.mappings ?? [],
      fieldDefaults: dto.fieldDefaults ?? [],
      relationMappings: dto.relationMappings ?? [],
      uniqueConflictStrategies: dto.uniqueConflictStrategies ?? [],
    };
    template.externalKeyColumns = this.normalizeColumns(dto.keyColumns ?? []);
    template.genericReferenceMapping = dto.genericReferenceMapping ?? null;
    await this.syncValueMappings(template, dto.valueMappings ?? []);

    await this.em.flush();
    await this.em.populate(
      template,
      ['source', 'targetEntity', 'valueMappings'],
      { refresh: true },
    );
    return this.toTemplateSummary(template);
  }

  private async syncValueMappings(
    template: ImportTemplateItem,
    mappings: ImportValueMappingDto[],
  ): Promise<void> {
    if (template.handle) {
      await this.em.nativeDelete(ImportTemplateValueMappingItem, {
        importTemplate: { handle: template.handle },
      });
    }
    await this.resetSerialSequence('import_template_value_mapping_item');

    for (const mapping of this.normalizeValueMappings(mappings)) {
      for (const [sourceValue, targetValue] of Object.entries(mapping.values)) {
        const valueMapping = new ImportTemplateValueMappingItem();
        valueMapping.importTemplate = template;
        valueMapping.targetField = mapping.targetField;
        valueMapping.sourceValue = sourceValue;
        valueMapping.targetValue = this.normalizeScalarString(targetValue);
        valueMapping.fallback = this.normalizeValueMappingFallback(
          mapping.fallback,
        );
        this.em.persist(valueMapping);
      }
    }
  }

  private async resetSerialSequence(
    tableName: 'import_template_item' | 'import_template_value_mapping_item',
  ): Promise<void> {
    await this.em.getConnection().execute(`
      select setval(
        pg_get_serial_sequence('${tableName}', 'handle'),
        coalesce((select max(handle) from ${tableName}), 1),
        (select max(handle) from ${tableName}) is not null
      )
    `);
  }

  private normalizeValueMappings(
    mappings: ImportValueMappingDto[],
  ): ImportValueMappingDto[] {
    const normalized: ImportValueMappingDto[] = [];

    for (const mapping of mappings) {
      const targetField = this.normalizeOptionalString(mapping.targetField);
      if (
        !targetField ||
        !mapping.values ||
        typeof mapping.values !== 'object'
      ) {
        continue;
      }

      const values: Record<string, unknown> = {};
      for (const [sourceValue, targetValue] of Object.entries(mapping.values)) {
        const sourceKey = this.normalizeScalarString(sourceValue);
        if (sourceKey && this.normalizeScalarString(targetValue)) {
          values[sourceKey] = targetValue;
        }
      }
      if (Object.keys(values).length > 0) {
        normalized.push({
          targetField,
          values,
          fallback: this.normalizeValueMappingFallback(mapping.fallback),
        });
      }
    }

    return normalized;
  }

  private getTemplateEntityValueMappings(
    template: ImportTemplateItem,
  ): ImportValueMappingDto[] {
    const groupedMappings = new Map<string, ImportValueMappingDto>();
    const valueMappings = template.valueMappings as unknown;
    if (!this.isValueMappingCollection(valueMappings)) {
      return [];
    }

    for (const valueMapping of valueMappings.isInitialized()
      ? valueMappings.getItems()
      : []) {
      if (!valueMapping.targetField || !valueMapping.sourceValue) {
        continue;
      }
      const fallback = this.normalizeValueMappingFallback(
        valueMapping.fallback as ImportValueMappingFallback,
      );
      const key = `${valueMapping.targetField}|${fallback}`;
      const existing = groupedMappings.get(key) ?? {
        targetField: valueMapping.targetField,
        values: {},
        fallback,
      };
      existing.values[valueMapping.sourceValue] = valueMapping.targetValue;
      groupedMappings.set(key, existing);
    }

    return [...groupedMappings.values()];
  }

  private isValueMappingCollection(value: unknown): value is {
    isInitialized: () => boolean;
    getItems: () => ImportTemplateValueMappingItem[];
  } {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.isInitialized === 'function' &&
      typeof candidate.getItems === 'function'
    );
  }

  private toTemplateSummary(
    template: ImportTemplateItem,
  ): ImportTemplateSummaryDto {
    return {
      handle: template.handle ?? null,
      title: template.title,
      description: template.description ?? null,
      sourceHandle: this.extractHandle(template.source) ?? '',
      entityHandle: this.extractHandle(template.targetEntity) ?? '',
      isActive: template.isActive,
      mapping: {
        ...(template.mapping ?? {}),
        valueMappings: this.getConfiguredValueMappings(template),
      },
      externalKeyColumns: template.externalKeyColumns ?? null,
      genericReferenceMapping: template.genericReferenceMapping ?? null,
    };
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
    return typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' || typeof value === 'boolean'
        ? value.toString().trim()
        : '';
  }

  private normalizeValueMappingFallback(
    fallback: ImportValueMappingFallback | undefined,
  ): ImportValueMappingFallback {
    return fallback === 'empty' || fallback === 'error' ? fallback : 'keep';
  }

  private extractHandle(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' ? handle : null;
  }
}
