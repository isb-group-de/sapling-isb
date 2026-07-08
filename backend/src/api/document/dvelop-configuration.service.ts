import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import axios from 'axios';
import { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import { DvelopObjectDefinitionItem } from '../../entity/DvelopObjectDefinitionItem';
import { DvelopPropertyItem } from '../../entity/DvelopPropertyItem';
import { DvelopRepositoryItem } from '../../entity/DvelopRepositoryItem';

const DVELOP_CONFIG_REQUEST_TIMEOUT_MS = 30_000;
const DVELOP_ACCEPT_HEADERS = [
  'application/hal+json',
  'application/json',
  '*/*',
];
const REPOSITORY_ENDPOINTS: DvelopRepositoryEndpoint[] = [
  { service: 'dms', segments: ['r'], repositoryScoped: false },
];
const OBJECT_DEFINITION_ENDPOINTS: DvelopRepositoryEndpoint[] = [
  { service: 'dms', segments: ['objdef'] },
  {
    service: 'dmsconfig',
    segments: ['objectmanagement', 'categories'],
    trailingSlash: true,
  },
  { service: 'dmsconfig', segments: ['objectdefinitions'] },
  { service: 'dmsconfig', segments: ['object-definitions'] },
  { service: 'dmsconfig', segments: ['categories'] },
];
const GLOBAL_PROPERTY_ENDPOINTS: DvelopRepositoryEndpoint[] = [
  { service: 'dmsconfig', segments: ['properties'] },
  { service: 'dmsconfig', segments: ['propertydefinitions'] },
  { service: 'dmsconfig', segments: ['property-definitions'] },
];
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

type CloudRecord = Record<string, unknown>;
type DvelopRepositoryEndpoint = {
  service: 'dms' | 'dmsconfig';
  segments: string[];
  trailingSlash?: boolean;
  repositoryScoped?: boolean;
};

type SyncSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

export interface DvelopImportedObjectDefinition {
  dvelopId?: string | null;
  title?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}

export interface DvelopImportedRepository {
  dvelopId?: string | null;
  title?: string | null;
  version?: string | null;
  isDefault?: boolean | null;
  isAvailable?: boolean | null;
}

export interface DvelopImportedProperty {
  dvelopId?: string | null;
  title?: string | null;
  dataType?: string | null;
  description?: string | null;
  isRequired?: boolean | null;
  isMultiValue?: boolean | null;
  isActive?: boolean | null;
}

export interface DvelopConfigurationImportPayload {
  repositories?: DvelopImportedRepository[];
  objectDefinitions?: DvelopImportedObjectDefinition[];
  properties?: DvelopImportedProperty[];
}

export interface DvelopConfigurationSyncPayload {
  repositories?: boolean;
  objectDefinitions?: boolean;
  properties?: boolean;
}

export interface DvelopConfigurationImportResponse {
  repositories: SyncSummary;
  objectDefinitions: SyncSummary;
  properties: SyncSummary;
}

@Injectable()
export class DvelopConfigurationService {
  constructor(private readonly em: EntityManager) {}

  async importConfiguration(
    connectionHandle: number,
    payload: DvelopConfigurationImportPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    const connection = await this.findConnection(connectionHandle);

    return this.importConfigurationForConnection(connection, payload);
  }

  async syncConfiguration(
    connectionHandle: number,
    payload: DvelopConfigurationSyncPayload = {},
  ): Promise<DvelopConfigurationImportResponse> {
    const connection = await this.findConnection(connectionHandle);
    const hasExplicitSelection =
      payload.repositories === true ||
      payload.objectDefinitions === true ||
      payload.properties === true;
    const includeRepositories = hasExplicitSelection
      ? payload.repositories === true
      : true;
    const includeObjectDefinitions = hasExplicitSelection
      ? payload.objectDefinitions === true
      : true;
    const includeProperties = hasExplicitSelection
      ? payload.properties === true
      : true;

    if (
      !includeRepositories &&
      !includeObjectDefinitions &&
      !includeProperties
    ) {
      throw new BadRequestException('global.invalidPayload');
    }

    const now = new Date();
    let repositories = this.createSummary([]);

    if (includeRepositories) {
      repositories = await this.importRepositories(
        connection,
        await this.fetchCloudRepositories(connection),
        now,
      );
      await this.em.flush();
    }

    let objectDefinitionPayload: unknown | null = null;
    if (includeObjectDefinitions || includeProperties) {
      try {
        objectDefinitionPayload =
          await this.fetchCloudObjectDefinitionPayload(connection);
      } catch (error) {
        if (includeObjectDefinitions) {
          throw error;
        }
      }
    }

    const objectDefinitionRecords = objectDefinitionPayload
      ? this.extractDocumentObjectDefinitionRecords(objectDefinitionPayload)
      : [];
    const objectDefinitions = includeObjectDefinitions
      ? this.normalizeObjectDefinitions(objectDefinitionRecords)
      : [];
    const properties = includeProperties
      ? await this.fetchCloudProperties(connection, objectDefinitionRecords)
      : [];

    const importedConfiguration = await this.importConfigurationForConnection(
      connection,
      {
        objectDefinitions,
        properties,
      },
    );

    return {
      repositories,
      objectDefinitions: importedConfiguration.objectDefinitions,
      properties: importedConfiguration.properties,
    };
  }

  private async importConfigurationForConnection(
    connection: DvelopConnectionItem,
    payload: DvelopConfigurationImportPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    const now = new Date();
    const repositories = await this.importRepositories(
      connection,
      payload.repositories ?? [],
      now,
    );
    const objectDefinitions = await this.importObjectDefinitions(
      connection,
      payload.objectDefinitions ?? [],
      now,
    );
    const properties = await this.importProperties(
      connection,
      payload.properties ?? [],
      now,
    );

    await this.em.flush();

    return { repositories, objectDefinitions, properties };
  }

  private async findConnection(
    connectionHandle: number,
  ): Promise<DvelopConnectionItem> {
    if (!Number.isFinite(connectionHandle)) {
      throw new BadRequestException('global.invalidPayload');
    }

    const connection = await this.em.findOne(
      DvelopConnectionItem,
      {
        handle: connectionHandle,
      },
      { populate: ['repository'] },
    );

    if (!connection) {
      throw new NotFoundException('document.dvelopConnectionNotFound');
    }

    return connection;
  }

  private async fetchCloudObjectDefinitionPayload(
    connection: DvelopConnectionItem,
  ): Promise<unknown> {
    return this.fetchFirstCloudPayload(connection, OBJECT_DEFINITION_ENDPOINTS);
  }

  private async fetchCloudRepositories(
    connection: DvelopConnectionItem,
  ): Promise<DvelopImportedRepository[]> {
    const payload = await this.fetchFirstCloudPayload(
      connection,
      REPOSITORY_ENDPOINTS,
    );

    return this.dedupeImportedRepositories(
      this.extractCloudCollection(payload)
        .map((record) => this.normalizeRepository(record))
        .filter((item): item is DvelopImportedRepository => item !== null),
    );
  }

  private async fetchCloudProperties(
    connection: DvelopConnectionItem,
    objectDefinitionRecords: CloudRecord[],
  ): Promise<DvelopImportedProperty[]> {
    const propertyFields = this.extractObjectDefinitionProperties(
      objectDefinitionRecords,
    );
    if (propertyFields.length > 0) {
      return this.dedupeImportedProperties(propertyFields);
    }

    const categoryProperties = await this.fetchCategoryProperties(
      connection,
      objectDefinitionRecords,
    );
    if (categoryProperties.length > 0) {
      return this.dedupeImportedProperties(categoryProperties);
    }

    const payload = await this.fetchFirstCloudPayload(
      connection,
      GLOBAL_PROPERTY_ENDPOINTS,
    );

    return this.dedupeImportedProperties(
      this.extractCloudCollection(payload)
        .map((record) => this.normalizeProperty(record))
        .filter((item): item is DvelopImportedProperty => item !== null),
    );
  }

  private extractDocumentObjectDefinitionRecords(
    payload: unknown,
  ): CloudRecord[] {
    return this.extractCloudCollection(payload).filter((record) =>
      this.isDocumentObjectDefinitionRecord(record),
    );
  }

  private normalizeObjectDefinitions(
    records: CloudRecord[],
  ): DvelopImportedObjectDefinition[] {
    return this.dedupeImportedObjectDefinitions(
      records
        .map((record) => this.normalizeObjectDefinition(record))
        .filter(
          (item): item is DvelopImportedObjectDefinition => item !== null,
        ),
    );
  }

  private extractObjectDefinitionProperties(
    objectDefinitionRecords: CloudRecord[],
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
    objectDefinitionRecords: CloudRecord[],
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

      const payload = await this.fetchFirstCloudPayload(
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

      const propertyRecords = this.extractCloudCollection(payload);
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

  private isDocumentObjectDefinitionRecord(record: CloudRecord): boolean {
    const type = this.normalizeString(this.readCaseInsensitive(record, 'type'));
    if (type && type !== 'DOCUMENT_TYPE') {
      return false;
    }

    const objectType = this.readCaseInsensitive(record, 'objectType');
    if (typeof objectType === 'number' && objectType !== 0) {
      return false;
    }

    return true;
  }

  private async fetchFirstCloudPayload(
    connection: DvelopConnectionItem,
    endpoints: DvelopRepositoryEndpoint[],
    throwOnFailure = true,
  ): Promise<unknown | null> {
    const authHeaders = this.buildDvelopAuthHeaders(connection);
    const urls = endpoints.map((endpoint) =>
      this.buildDvelopRepositoryUrl(connection, endpoint),
    );
    const errors: string[] = [];

    for (const url of urls) {
      let urlError: string | null = null;

      for (const acceptHeader of DVELOP_ACCEPT_HEADERS) {
        try {
          const response = await axios.get<unknown>(url, {
            headers: {
              ...authHeaders,
              Accept: acceptHeader,
            },
            timeout: DVELOP_CONFIG_REQUEST_TIMEOUT_MS,
            validateStatus: () => true,
          });

          if (response.status >= 200 && response.status < 300) {
            return response.data;
          }

          urlError = `${url}: ${response.status} ${response.statusText}`.trim();

          if (response.status !== 406) {
            break;
          }
        } catch (error) {
          urlError = `${url}: ${this.getCloudErrorMessage(error)}`;
          break;
        }
      }

      errors.push(urlError ?? `${url}: request failed`);
    }

    if (throwOnFailure) {
      throw new BadRequestException(errors.join('\n'));
    }

    return null;
  }

  private buildDvelopAuthHeaders(
    connection: DvelopConnectionItem,
  ): Record<string, string> {
    const apiKey = connection.apiKey?.trim();
    if (!apiKey) {
      throw new BadRequestException('document.dvelopApiKeyMissing');
    }

    return {
      Authorization: apiKey.toLowerCase().startsWith('bearer ')
        ? apiKey
        : `Bearer ${apiKey}`,
    };
  }

  private buildDvelopRepositoryUrl(
    connection: DvelopConnectionItem,
    endpoint: DvelopRepositoryEndpoint,
  ): string {
    let base: URL;
    try {
      base = new URL(connection.baseUrl.trim());
    } catch {
      throw new BadRequestException('document.dvelopBaseUrlInvalid');
    }

    if (!['http:', 'https:'].includes(base.protocol)) {
      throw new BadRequestException('document.dvelopBaseUrlInvalid');
    }

    const repositoryScoped = endpoint.repositoryScoped !== false;
    const repositoryId = repositoryScoped
      ? this.getConnectionRepositoryId(connection)
      : null;

    if (repositoryScoped && !repositoryId) {
      throw new BadRequestException('document.dvelopRepositoryMissing');
    }

    const path = repositoryScoped
      ? [
          endpoint.service,
          'r',
          encodeURIComponent(repositoryId ?? ''),
          ...endpoint.segments.map((segment) => encodeURIComponent(segment)),
        ].join('/')
      : [
          endpoint.service,
          ...endpoint.segments.map((segment) => encodeURIComponent(segment)),
        ].join('/');

    return new URL(
      `/${path}${endpoint.trailingSlash ? '/' : ''}`,
      base,
    ).toString();
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

  private extractCloudCollection(payload: unknown): CloudRecord[] {
    const records = this.collectCloudCollectionRecords(payload, 0);
    if (records.length > 0) {
      return records;
    }

    if (!this.isRecord(payload)) {
      return [];
    }

    return Object.values(payload).filter(this.isRecord);
  }

  private collectCloudCollectionRecords(
    payload: unknown,
    depth: number,
  ): CloudRecord[] {
    if (depth > 8) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload.filter(this.isRecord);
    }

    if (!this.isRecord(payload)) {
      return [];
    }

    for (const key of COLLECTION_KEYS) {
      const value = this.readCaseInsensitive(payload, key);
      const records = this.collectCloudCollectionRecords(value, depth + 1);
      if (records.length > 0) {
        return records;
      }
    }

    const embedded = this.readCaseInsensitive(payload, '_embedded');
    const embeddedRecords = this.collectCloudCollectionRecords(
      embedded,
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

  private collectionFromValue(value: unknown): CloudRecord[] {
    if (Array.isArray(value)) {
      return value.filter(this.isRecord);
    }

    if (!this.isRecord(value)) {
      return [];
    }

    const nestedCollection = this.collectCloudCollectionRecords(value, 0);
    return nestedCollection.length > 0
      ? nestedCollection
      : Object.values(value).filter(this.isRecord);
  }

  private normalizeObjectDefinition(
    record: CloudRecord,
  ): DvelopImportedObjectDefinition | null {
    const dvelopId = this.readFirstString(record, OBJECT_DEFINITION_ID_KEYS);
    if (!dvelopId) {
      return null;
    }

    return {
      dvelopId,
      title: this.readFirstString(record, TITLE_KEYS) ?? dvelopId,
      description: this.readFirstString(record, DESCRIPTION_KEYS),
      isActive: true,
    };
  }

  private normalizeRepository(
    record: CloudRecord,
  ): DvelopImportedRepository | null {
    const dvelopId = this.readFirstString(record, REPOSITORY_ID_KEYS);
    if (!dvelopId) {
      return null;
    }

    return {
      dvelopId,
      title: this.readFirstString(record, TITLE_KEYS) ?? dvelopId,
      version: this.readFirstString(record, VERSION_KEYS),
      isDefault: this.readFirstBoolean(record, DEFAULT_KEYS) ?? false,
      isAvailable: this.readFirstBoolean(record, AVAILABLE_KEYS) ?? true,
    };
  }

  private normalizeProperty(
    record: CloudRecord,
  ): DvelopImportedProperty | null {
    const dvelopId = this.readFirstString(record, PROPERTY_ID_KEYS);
    if (!dvelopId) {
      return null;
    }

    return {
      dvelopId,
      title: this.readFirstString(record, TITLE_KEYS) ?? dvelopId,
      dataType: this.readFirstString(record, DATA_TYPE_KEYS),
      description: this.readFirstString(record, DESCRIPTION_KEYS),
      isRequired: this.readFirstBoolean(record, REQUIRED_KEYS) ?? false,
      isMultiValue: this.readFirstBoolean(record, MULTI_VALUE_KEYS) ?? false,
      isActive: true,
    };
  }

  private readFirstString(record: CloudRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = this.normalizeString(this.readCaseInsensitive(record, key));
      if (value) {
        return value;
      }
    }

    return null;
  }

  private readFirstBoolean(
    record: CloudRecord,
    keys: string[],
  ): boolean | null {
    for (const key of keys) {
      const value = this.readCaseInsensitive(record, key);
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'ja'].includes(normalized)) {
          return true;
        }
        if (['false', '0', 'no', 'nein'].includes(normalized)) {
          return false;
        }
      }
    }

    return null;
  }

  private readCaseInsensitive(record: CloudRecord, key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }

    const matchingKey = Object.keys(record).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );

    return matchingKey ? record[matchingKey] : undefined;
  }

  private async importObjectDefinitions(
    connection: DvelopConnectionItem,
    items: DvelopImportedObjectDefinition[],
    now: Date,
  ): Promise<SyncSummary> {
    const summary = this.createSummary(items);

    for (const item of items) {
      const dvelopId = this.normalizeString(item.dvelopId);
      if (!dvelopId) {
        summary.skipped += 1;
        continue;
      }

      const title = this.normalizeString(item.title) ?? dvelopId;
      const existing = await this.em.findOne(DvelopObjectDefinitionItem, {
        connection,
        dvelopId,
      });
      const values = {
        connection,
        dvelopId,
        title,
        description: this.normalizeString(item.description),
        isActive: item.isActive !== false,
        lastSyncedAt: now,
      };

      if (existing) {
        this.em.assign(existing, values);
        summary.updated += 1;
        continue;
      }

      const created = this.em.create(DvelopObjectDefinitionItem, values);
      this.em.persist(created);
      summary.created += 1;
    }

    return summary;
  }

  private async importProperties(
    connection: DvelopConnectionItem,
    items: DvelopImportedProperty[],
    now: Date,
  ): Promise<SyncSummary> {
    const summary = this.createSummary(items);

    for (const item of items) {
      const dvelopId = this.normalizeString(item.dvelopId);
      if (!dvelopId) {
        summary.skipped += 1;
        continue;
      }

      const title = this.normalizeString(item.title) ?? dvelopId;
      const existing = await this.em.findOne(DvelopPropertyItem, {
        connection,
        dvelopId,
      });
      const values = {
        connection,
        dvelopId,
        title,
        dataType: this.normalizeString(item.dataType),
        description: this.normalizeString(item.description),
        isRequired: item.isRequired === true,
        isMultiValue: item.isMultiValue === true,
        isActive: item.isActive !== false,
        lastSyncedAt: now,
      };

      if (existing) {
        this.em.assign(existing, values);
        summary.updated += 1;
        continue;
      }

      const created = this.em.create(DvelopPropertyItem, values);
      this.em.persist(created);
      summary.created += 1;
    }

    return summary;
  }

  private async importRepositories(
    connection: DvelopConnectionItem,
    items: DvelopImportedRepository[],
    now: Date,
  ): Promise<SyncSummary> {
    const summary = this.createSummary(items);
    let preferredRepository: DvelopRepositoryItem | null = null;
    const currentRepositoryId = this.getConnectionRepositoryId(connection);

    for (const item of items) {
      const dvelopId = this.normalizeString(item.dvelopId);
      if (!dvelopId) {
        summary.skipped += 1;
        continue;
      }

      const title = this.normalizeString(item.title) ?? dvelopId;
      const existing = await this.em.findOne(DvelopRepositoryItem, {
        connection,
        dvelopId,
      });
      const values = {
        connection,
        dvelopId,
        title,
        version: this.normalizeString(item.version),
        isDefault: item.isDefault === true,
        isAvailable: item.isAvailable !== false,
        lastSyncedAt: now,
      };

      const repository =
        existing ?? this.em.create(DvelopRepositoryItem, values);
      if (existing) {
        this.em.assign(existing, values);
        summary.updated += 1;
      } else {
        this.em.persist(repository);
        summary.created += 1;
      }

      if (
        dvelopId === currentRepositoryId ||
        (!preferredRepository && item.isDefault === true) ||
        (!preferredRepository && !currentRepositoryId)
      ) {
        preferredRepository = repository;
      }
    }

    if (!currentRepositoryId && preferredRepository) {
      connection.repository = preferredRepository;
    }

    return summary;
  }

  private dedupeImportedRepositories(
    items: DvelopImportedRepository[],
  ): DvelopImportedRepository[] {
    const map = new Map<string, DvelopImportedRepository>();

    for (const item of items) {
      const dvelopId = this.normalizeString(item.dvelopId);
      if (dvelopId && !map.has(dvelopId)) {
        map.set(dvelopId, item);
      }
    }

    return [...map.values()];
  }

  private dedupeImportedObjectDefinitions(
    items: DvelopImportedObjectDefinition[],
  ): DvelopImportedObjectDefinition[] {
    const map = new Map<string, DvelopImportedObjectDefinition>();

    for (const item of items) {
      const dvelopId = this.normalizeString(item.dvelopId);
      if (dvelopId && !map.has(dvelopId)) {
        map.set(dvelopId, item);
      }
    }

    return [...map.values()];
  }

  private dedupeImportedProperties(
    items: DvelopImportedProperty[],
  ): DvelopImportedProperty[] {
    const map = new Map<string, DvelopImportedProperty>();

    for (const item of items) {
      const dvelopId = this.normalizeString(item.dvelopId);
      if (dvelopId && !map.has(dvelopId)) {
        map.set(dvelopId, item);
      }
    }

    return [...map.values()];
  }

  private createSummary(items: unknown[]): SyncSummary {
    return {
      total: Array.isArray(items) ? items.length : 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (this.isRecord(value)) {
      return this.readFirstString(value, [
        'displayName',
        'name',
        'title',
        'de',
        'en',
        'value',
        'text',
      ]);
    }

    return null;
  }

  private isRecord(value: unknown): value is CloudRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getCloudErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return `${error.response.status} ${error.response.statusText}`.trim();
      }

      return error.message;
    }

    return error instanceof Error ? error.message : String(error);
  }
}
