import { Injectable, Optional } from '@nestjs/common';
import { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import {
  DVELOP_GLOBAL_PROPERTY_ENDPOINTS,
  DVELOP_OBJECT_DEFINITION_ENDPOINTS,
  DVELOP_REPOSITORY_ENDPOINTS,
  DvelopCloudClientService,
} from './dvelop-cloud-client.service';
import type {
  DvelopCloudRecord,
  DvelopImportedObjectDefinition,
  DvelopImportedProperty,
  DvelopImportedRepository,
} from './dvelop-configuration.types';

const COLLECTION_KEYS = [
  'items',
  'value',
  'values',
  'data',
  'entries',
  'repositories',
  'objectDefinitions',
  'objectdefinitions',
  'categories',
  'properties',
  'propertyDefinitions',
  'propertydefinitions',
];
const REPOSITORY_ID_KEYS = [
  'id',
  'repositoryId',
  'repositoryid',
  'repositoryGuid',
  'repositoryguid',
  'repository',
];
const OBJECT_DEFINITION_ID_KEYS = [
  'id',
  'objectDefinitionId',
  'objectdefinitionid',
  'objectDefinition',
  'categoryId',
  'category',
];
const PROPERTY_ID_KEYS = [
  'id',
  'propertyId',
  'propertyid',
  'property',
  'key',
  'uniqueId',
  'name',
];
const PROPERTY_OBJECT_DEFINITION_ID_KEYS = [
  'objectDefinitionId',
  'objectdefinitionid',
  'objectDefinition',
  'categoryId',
  'category',
];
const TITLE_KEYS = [
  'displayName',
  'caption',
  'title',
  'label',
  'name',
  'description',
];
const DESCRIPTION_KEYS = ['description', 'helpText', 'tooltip'];
const DATA_TYPE_KEYS = ['dataType', 'type', 'propertyType', 'valueType'];
const REQUIRED_KEYS = ['required', 'isRequired', 'mandatory'];
const MULTI_VALUE_KEYS = ['multiValue', 'isMultiValue', 'multiple'];
const VERSION_KEYS = ['version', 'repositoryVersion'];
const DEFAULT_KEYS = ['default', 'isDefault', 'defaultRepository'];
const AVAILABLE_KEYS = ['available', 'isAvailable', 'enabled', 'active'];

@Injectable()
export class DvelopCloudMetadataService {
  private readonly client: DvelopCloudClientService;

  constructor(@Optional() client?: DvelopCloudClientService) {
    this.client = client ?? new DvelopCloudClientService();
  }

  async fetchRepositories(
    connection: DvelopConnectionItem,
  ): Promise<DvelopImportedRepository[]> {
    const payload = await this.client.fetchFirstPayload(
      connection,
      DVELOP_REPOSITORY_ENDPOINTS,
    );

    return this.dedupeRepositories(
      this.extractCloudCollection(payload)
        .map((record) => this.normalizeRepository(record))
        .filter((item): item is DvelopImportedRepository => item !== null),
    );
  }

  async fetchObjectDefinitionRecords(
    connection: DvelopConnectionItem,
  ): Promise<DvelopCloudRecord[]> {
    const payload = await this.client.fetchFirstPayload(
      connection,
      DVELOP_OBJECT_DEFINITION_ENDPOINTS,
    );

    return this.extractCloudCollection(payload).filter((record) =>
      this.isDocumentObjectDefinitionRecord(record),
    );
  }

  normalizeObjectDefinitions(
    records: DvelopCloudRecord[],
  ): DvelopImportedObjectDefinition[] {
    return this.dedupeObjectDefinitions(
      records
        .map((record) => this.normalizeObjectDefinition(record))
        .filter(
          (item): item is DvelopImportedObjectDefinition => item !== null,
        ),
    );
  }

  async fetchProperties(
    connection: DvelopConnectionItem,
    objectDefinitionRecords: DvelopCloudRecord[],
  ): Promise<DvelopImportedProperty[]> {
    const propertyFields = this.extractObjectDefinitionProperties(
      objectDefinitionRecords,
    );
    if (propertyFields.length > 0) {
      return this.dedupeProperties(propertyFields);
    }

    const categoryProperties = await this.fetchCategoryProperties(
      connection,
      objectDefinitionRecords,
    );
    if (categoryProperties.length > 0) {
      return this.dedupeProperties(categoryProperties);
    }

    const payload = await this.client.fetchFirstPayload(
      connection,
      DVELOP_GLOBAL_PROPERTY_ENDPOINTS,
    );

    return this.dedupeProperties(
      this.extractCloudCollection(payload)
        .map((record) => this.normalizeProperty(record))
        .filter((item): item is DvelopImportedProperty => item !== null),
    );
  }

  private extractObjectDefinitionProperties(
    objectDefinitionRecords: DvelopCloudRecord[],
  ): DvelopImportedProperty[] {
    const properties: DvelopImportedProperty[] = [];

    for (const objectDefinitionRecord of objectDefinitionRecords) {
      const objectDefinitionId = this.readFirstString(
        objectDefinitionRecord,
        OBJECT_DEFINITION_ID_KEYS,
      );
      const propertyRecords = this.collectionFromValue(
        this.readCaseInsensitive(objectDefinitionRecord, 'propertyFields'),
      );

      for (const propertyRecord of propertyRecords) {
        const property = this.normalizeProperty({
          ...propertyRecord,
          objectDefinitionId,
        });
        if (property) {
          properties.push(property);
        }
      }
    }

    return properties;
  }

  private async fetchCategoryProperties(
    connection: DvelopConnectionItem,
    objectDefinitionRecords: DvelopCloudRecord[],
  ): Promise<DvelopImportedProperty[]> {
    const properties: DvelopImportedProperty[] = [];

    for (const objectDefinitionRecord of objectDefinitionRecords) {
      const objectDefinitionId = this.readFirstString(
        objectDefinitionRecord,
        OBJECT_DEFINITION_ID_KEYS,
      );
      if (!objectDefinitionId) {
        continue;
      }

      const payload = await this.client.fetchFirstPayload(
        connection,
        [
          {
            service: 'dmsconfig',
            segments: ['objectmanagement', 'categories', objectDefinitionId],
          },
        ],
        false,
      );
      if (!payload) {
        continue;
      }

      for (const propertyRecord of this.extractCloudCollection(payload)) {
        const property = this.normalizeProperty({
          ...propertyRecord,
          objectDefinitionId,
        });
        if (property) {
          properties.push(property);
        }
      }
    }

    return properties;
  }

  private isDocumentObjectDefinitionRecord(record: DvelopCloudRecord): boolean {
    const type = normalizeString(this.readCaseInsensitive(record, 'type'));
    if (type && type !== 'DOCUMENT_TYPE') {
      return false;
    }

    const objectType = this.readCaseInsensitive(record, 'objectType');
    return typeof objectType !== 'number' || objectType === 0;
  }

  private extractCloudCollection(payload: unknown): DvelopCloudRecord[] {
    const records = this.collectCloudCollectionRecords(payload, 0);
    if (records.length > 0) {
      return records;
    }

    return isRecord(payload) ? Object.values(payload).filter(isRecord) : [];
  }

  private collectCloudCollectionRecords(
    payload: unknown,
    depth: number,
  ): DvelopCloudRecord[] {
    if (depth > 8) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload.filter(isRecord);
    }
    if (!isRecord(payload)) {
      return [];
    }

    for (const key of COLLECTION_KEYS) {
      const records = this.collectCloudCollectionRecords(
        this.readCaseInsensitive(payload, key),
        depth + 1,
      );
      if (records.length > 0) {
        return records;
      }
    }

    const embeddedRecords = this.collectCloudCollectionRecords(
      this.readCaseInsensitive(payload, '_embedded'),
      depth + 1,
    );
    if (embeddedRecords.length > 0) {
      return embeddedRecords;
    }

    for (const value of Object.values(payload)) {
      const records = this.collectCloudCollectionRecords(value, depth + 1);
      if (records.length > 0) {
        return records;
      }
    }

    return [];
  }

  private collectionFromValue(value: unknown): DvelopCloudRecord[] {
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
    if (!isRecord(value)) {
      return [];
    }

    const nestedCollection = this.collectCloudCollectionRecords(value, 0);
    return nestedCollection.length > 0
      ? nestedCollection
      : Object.values(value).filter(isRecord);
  }

  private normalizeObjectDefinition(
    record: DvelopCloudRecord,
  ): DvelopImportedObjectDefinition | null {
    const dvelopId = this.readFirstString(record, OBJECT_DEFINITION_ID_KEYS);
    return dvelopId
      ? {
          dvelopId,
          title: this.readFirstString(record, TITLE_KEYS) ?? dvelopId,
          description: this.readFirstString(record, DESCRIPTION_KEYS),
          isActive: true,
        }
      : null;
  }

  private normalizeRepository(
    record: DvelopCloudRecord,
  ): DvelopImportedRepository | null {
    const dvelopId = this.readFirstString(record, REPOSITORY_ID_KEYS);
    return dvelopId
      ? {
          dvelopId,
          title: this.readFirstString(record, TITLE_KEYS) ?? dvelopId,
          version: this.readFirstString(record, VERSION_KEYS),
          isDefault: this.readFirstBoolean(record, DEFAULT_KEYS) ?? false,
          isAvailable: this.readFirstBoolean(record, AVAILABLE_KEYS) ?? true,
        }
      : null;
  }

  private normalizeProperty(
    record: DvelopCloudRecord,
  ): DvelopImportedProperty | null {
    const dvelopId = this.readFirstString(record, PROPERTY_ID_KEYS);
    return dvelopId
      ? {
          dvelopId,
          objectDefinitionId: this.readFirstString(
            record,
            PROPERTY_OBJECT_DEFINITION_ID_KEYS,
          ),
          title: this.readFirstString(record, TITLE_KEYS) ?? dvelopId,
          dataType: this.readFirstString(record, DATA_TYPE_KEYS),
          description: this.readFirstString(record, DESCRIPTION_KEYS),
          isRequired: this.readFirstBoolean(record, REQUIRED_KEYS) ?? false,
          isMultiValue:
            this.readFirstBoolean(record, MULTI_VALUE_KEYS) ?? false,
          isActive: true,
        }
      : null;
  }

  private readFirstString(
    record: DvelopCloudRecord,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = normalizeString(this.readCaseInsensitive(record, key));
      if (value) {
        return value;
      }
    }
    return null;
  }

  private readFirstBoolean(
    record: DvelopCloudRecord,
    keys: string[],
  ): boolean | null {
    for (const key of keys) {
      const value = this.readCaseInsensitive(record, key);
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'ja'].includes(normalized)) return true;
        if (['false', '0', 'no', 'nein'].includes(normalized)) return false;
      }
    }
    return null;
  }

  private readCaseInsensitive(record: DvelopCloudRecord, key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
    const matchingKey = Object.keys(record).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    return matchingKey ? record[matchingKey] : undefined;
  }

  private dedupeRepositories(
    items: DvelopImportedRepository[],
  ): DvelopImportedRepository[] {
    return dedupeBy(items, (item) => normalizeString(item.dvelopId));
  }

  private dedupeObjectDefinitions(
    items: DvelopImportedObjectDefinition[],
  ): DvelopImportedObjectDefinition[] {
    return dedupeBy(items, (item) => normalizeString(item.dvelopId));
  }

  private dedupeProperties(
    items: DvelopImportedProperty[],
  ): DvelopImportedProperty[] {
    return dedupeBy(items, (item) => {
      const dvelopId = normalizeString(item.dvelopId);
      const objectDefinitionId = normalizeString(item.objectDefinitionId) ?? '';
      return dvelopId ? `${objectDefinitionId}:${dvelopId}` : null;
    });
  }
}

function dedupeBy<T>(items: T[], readKey: (item: T) => string | null): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = readKey(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isRecord(value)) {
    for (const key of [
      'displayName',
      'name',
      'title',
      'de',
      'en',
      'value',
      'text',
    ]) {
      const matchingKey = Object.keys(value).find(
        (candidate) => candidate.toLowerCase() === key.toLowerCase(),
      );
      const normalized = matchingKey
        ? normalizeString(value[matchingKey])
        : null;
      if (normalized) return normalized;
    }
  }
  return null;
}

function isRecord(value: unknown): value is DvelopCloudRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
