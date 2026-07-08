import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type EntityName } from '@mikro-orm/core';
import { DvelopEntityMappingItem } from '../../entity/DvelopEntityMappingItem';
import type { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import type { DvelopEntityMappingPropertyItem } from '../../entity/DvelopEntityMappingPropertyItem';
import type { DvelopObjectDefinitionItem } from '../../entity/DvelopObjectDefinitionItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';

type SaplingRecord = Record<string, unknown>;

export interface DvelopDocumentActionResponse {
  isActive: boolean;
  mode: 'dvelopCloud' | 'local';
  url?: string;
  connectionHandle?: number;
  mappingHandle?: number;
  reason?: string;
}

interface ResolvedDvelopContext {
  mapping: DvelopEntityMappingItem;
  connection: DvelopConnectionItem;
  record: SaplingRecord;
  properties: Record<string, string>;
}

@Injectable()
export class DvelopDocumentService {
  constructor(private readonly em: EntityManager) {}

  async buildDocumentsUrl(
    entityHandle: string,
    reference: string,
  ): Promise<DvelopDocumentActionResponse> {
    const context = await this.resolveContext(entityHandle, reference);

    if (!context) {
      return {
        isActive: false,
        mode: 'local',
        reason: 'notConfigured',
      };
    }

    const url = this.buildDmsUrl(context.connection.baseUrl, [
      'r',
      this.requireConnectionRepositoryId(context.connection),
      'sr',
    ]);
    const searchProperties = Object.fromEntries(
      Object.entries(context.properties).map(([key, value]) => [key, [value]]),
    );

    url.searchParams.set('properties', JSON.stringify(searchProperties));

    const objectDefinitionIds = this.getSearchObjectDefinitionIds(
      context.mapping,
    );
    if (objectDefinitionIds.length > 0) {
      url.searchParams.set(
        'objectdefinitionids',
        JSON.stringify(objectDefinitionIds),
      );
    }

    return this.buildActiveResponse(context, url);
  }

  async buildUploadDialogUrl(
    entityHandle: string,
    reference: string,
  ): Promise<DvelopDocumentActionResponse> {
    const context = await this.resolveContext(entityHandle, reference);

    if (!context) {
      return {
        isActive: false,
        mode: 'local',
        reason: 'notConfigured',
      };
    }

    const url = this.buildDmsUrl(context.connection.baseUrl, ['new']);
    url.searchParams.set(
      'repositoryid',
      this.requireConnectionRepositoryId(context.connection),
    );

    const objectDefinitionId =
      this.getObjectDefinitionDvelopId(context.mapping.objectDefinition) ??
      this.getObjectDefinitionDvelopId(
        context.connection.defaultObjectDefinition,
      );
    if (objectDefinitionId) {
      url.searchParams.set('objectdefinitionid', objectDefinitionId);
    }

    url.searchParams.set('properties', JSON.stringify(context.properties));

    return this.buildActiveResponse(context, url);
  }

  private async resolveContext(
    entityHandle: string,
    reference: string,
  ): Promise<ResolvedDvelopContext | null> {
    const mapping = await this.em.findOne(
      DvelopEntityMappingItem,
      {
        isActive: true,
        entity: { handle: entityHandle },
        connection: { isActive: true },
      },
      {
        populate: [
          'connection',
          'connection.repository',
          'connection.defaultObjectDefinition',
          'entity',
          'objectDefinition',
          'propertyMappings.property',
          'searchCategories.objectDefinition',
        ],
        orderBy: { handle: 'ASC' },
      },
    );

    if (!mapping) {
      return null;
    }

    const connection = mapping.connection as DvelopConnectionItem;
    this.assertConnection(connection);

    const entityClass = ENTITY_MAP[entityHandle] as
      | EntityName<object>
      | undefined;
    if (!entityClass) {
      throw new NotFoundException('global.entityNotFound');
    }

    const record = await this.findRecord(entityClass, reference);

    if (!record) {
      throw new NotFoundException('global.recordNotFound');
    }

    const properties = this.resolveProperties(mapping, record);

    return { mapping, connection, record, properties };
  }

  private resolveProperties(
    mapping: DvelopEntityMappingItem,
    record: SaplingRecord,
  ): Record<string, string> {
    const properties: Record<string, string> = {};

    const propertyMappings = this.getActivePropertyMappings(mapping);
    for (const propertyMapping of propertyMappings) {
      const dvelopProperty = this.getPropertyDvelopId(propertyMapping)?.trim();

      if (!dvelopProperty) {
        continue;
      }

      const rawValue =
        propertyMapping.staticValue ??
        this.readRecordValue(record, propertyMapping.sourceField ?? 'handle');
      const value = this.stringifyValue(rawValue);

      if (value != null) {
        properties[dvelopProperty] = value;
      }
    }

    if (Object.keys(properties).length === 0) {
      throw new BadRequestException('document.dvelopPropertyMappingMissing');
    }

    return properties;
  }

  private readRecordValue(record: SaplingRecord, sourceField: string): unknown {
    const parts = sourceField
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);

    let value: unknown = record;
    for (const part of parts) {
      if (value == null || typeof value !== 'object') {
        return undefined;
      }

      value = (value as Record<string, unknown>)[part];
    }

    if (value && typeof value === 'object' && 'handle' in value) {
      return (value as { handle?: unknown }).handle;
    }

    return value;
  }

  private stringifyValue(value: unknown): string | null {
    if (value == null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  private buildDmsUrl(baseUrl: string, pathSegments: string[]): URL {
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const base = new URL(normalizedBaseUrl);

    if (!['http:', 'https:'].includes(base.protocol)) {
      throw new BadRequestException('document.dvelopBaseUrlInvalid');
    }

    const dmsPath = ['dms', ...pathSegments.map(encodeURIComponent)].join('/');

    return new URL(`/${dmsPath}`, base);
  }

  private getSearchObjectDefinitionIds(
    mapping: DvelopEntityMappingItem,
  ): string[] {
    const ids =
      mapping.searchCategories
        ?.getItems()
        .filter((searchCategory) => searchCategory.isActive)
        .toSorted((left, right) => left.sortOrder - right.sortOrder)
        .map((searchCategory) =>
          this.getObjectDefinitionDvelopId(searchCategory.objectDefinition),
        )
        .filter((id): id is string => Boolean(id)) ?? [];

    if (ids.length > 0) {
      return ids;
    }

    const objectDefinitionId = this.getObjectDefinitionDvelopId(
      mapping.objectDefinition,
    );

    return objectDefinitionId ? [objectDefinitionId] : [];
  }

  private getActivePropertyMappings(
    mapping: DvelopEntityMappingItem,
  ): DvelopEntityMappingPropertyItem[] {
    return (
      mapping.propertyMappings
        ?.getItems()
        .filter((propertyMapping) => propertyMapping.isActive)
        .toSorted((left, right) => left.sortOrder - right.sortOrder) ?? []
    );
  }

  private getObjectDefinitionDvelopId(
    objectDefinition: DvelopObjectDefinitionItem | number | string | undefined,
  ): string | null {
    if (
      objectDefinition &&
      typeof objectDefinition === 'object' &&
      'dvelopId' in objectDefinition
    ) {
      return objectDefinition.dvelopId?.trim() || null;
    }

    return null;
  }

  private getPropertyDvelopId(
    propertyMapping: DvelopEntityMappingPropertyItem,
  ): string | null {
    const property = propertyMapping.property;
    if (property && typeof property === 'object' && 'dvelopId' in property) {
      return property.dvelopId?.trim() || null;
    }

    return null;
  }

  private async findRecord(
    entityClass: EntityName<object>,
    reference: string,
  ): Promise<SaplingRecord | null> {
    const meta = this.em.getMetadata().get(entityClass);
    const handleProperty = (
      meta.properties as Record<string, { type?: string }>
    ).handle;
    const typedReference =
      handleProperty?.type === 'number' && /^\d+$/.test(reference)
        ? Number(reference)
        : reference;

    return (await this.em.findOne(entityClass, {
      handle: typedReference,
    } as never)) as SaplingRecord | null;
  }

  private assertConnection(connection: DvelopConnectionItem): void {
    try {
      this.buildDmsUrl(connection.baseUrl, []);
    } catch {
      throw new BadRequestException('document.dvelopBaseUrlInvalid');
    }

    if (!this.getConnectionRepositoryId(connection)) {
      throw new BadRequestException('document.dvelopRepositoryMissing');
    }
  }

  private requireConnectionRepositoryId(
    connection: DvelopConnectionItem,
  ): string {
    const repositoryId = this.getConnectionRepositoryId(connection);
    if (!repositoryId) {
      throw new BadRequestException('document.dvelopRepositoryMissing');
    }

    return repositoryId;
  }

  private getConnectionRepositoryId(
    connection: DvelopConnectionItem,
  ): string | null {
    const repository = connection.repository;

    if (
      repository &&
      typeof repository === 'object' &&
      'dvelopId' in repository
    ) {
      return repository.dvelopId?.trim() || null;
    }

    return null;
  }

  private buildActiveResponse(
    context: ResolvedDvelopContext,
    url: URL,
  ): DvelopDocumentActionResponse {
    return {
      isActive: true,
      mode: 'dvelopCloud',
      url: url.toString(),
      connectionHandle: context.connection.handle,
      mappingHandle: context.mapping.handle,
    };
  }
}
