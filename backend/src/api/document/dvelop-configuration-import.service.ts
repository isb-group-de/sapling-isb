import { EntityManager } from '@mikro-orm/core';
import { Injectable, Optional } from '@nestjs/common';
import { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import { DvelopObjectDefinitionItem } from '../../entity/DvelopObjectDefinitionItem';
import { DvelopPropertyItem } from '../../entity/DvelopPropertyItem';
import { DvelopRepositoryItem } from '../../entity/DvelopRepositoryItem';
import { DvelopCloudClientService } from './dvelop-cloud-client.service';
import type {
  DvelopConfigurationImportPayload,
  DvelopConfigurationImportResponse,
  DvelopImportedObjectDefinition,
  DvelopImportedProperty,
  DvelopImportedRepository,
  DvelopSyncSummary,
} from './dvelop-configuration.types';

@Injectable()
export class DvelopConfigurationImportService {
  private readonly client: DvelopCloudClientService;

  constructor(
    private readonly em: EntityManager,
    @Optional() client?: DvelopCloudClientService,
  ) {
    this.client = client ?? new DvelopCloudClientService();
  }

  async importConfiguration(
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

  async importRepositories(
    connection: DvelopConnectionItem,
    items: DvelopImportedRepository[],
    now: Date,
  ): Promise<DvelopSyncSummary> {
    const summary = createSummary(items);
    let preferredRepository: DvelopRepositoryItem | null = null;
    const currentRepositoryId = this.client.getRepositoryId(connection);

    for (const item of items) {
      const dvelopId = normalizeString(item.dvelopId);
      if (!dvelopId) {
        summary.skipped += 1;
        continue;
      }

      const title = normalizeString(item.title) ?? dvelopId;
      const existing = await this.em.findOne(DvelopRepositoryItem, {
        connection,
        dvelopId,
      });
      const values = {
        connection,
        dvelopId,
        title,
        version: normalizeString(item.version),
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

  private async importObjectDefinitions(
    connection: DvelopConnectionItem,
    items: DvelopImportedObjectDefinition[],
    now: Date,
  ): Promise<DvelopSyncSummary> {
    const summary = createSummary(items);

    for (const item of items) {
      const dvelopId = normalizeString(item.dvelopId);
      if (!dvelopId) {
        summary.skipped += 1;
        continue;
      }

      const values = {
        connection,
        dvelopId,
        title: normalizeString(item.title) ?? dvelopId,
        description: normalizeString(item.description),
        isActive: item.isActive !== false,
        lastSyncedAt: now,
      };
      const existing = await this.em.findOne(DvelopObjectDefinitionItem, {
        connection,
        dvelopId,
      });

      if (existing) {
        this.em.assign(existing, values);
        summary.updated += 1;
      } else {
        this.em.persist(this.em.create(DvelopObjectDefinitionItem, values));
        summary.created += 1;
      }
    }

    return summary;
  }

  private async importProperties(
    connection: DvelopConnectionItem,
    items: DvelopImportedProperty[],
    now: Date,
  ): Promise<DvelopSyncSummary> {
    const summary = createSummary(items);

    for (const item of items) {
      const dvelopId = normalizeString(item.dvelopId);
      if (!dvelopId) {
        summary.skipped += 1;
        continue;
      }

      const objectDefinitionId = normalizeString(item.objectDefinitionId);
      const objectDefinition = objectDefinitionId
        ? await this.em.findOne(DvelopObjectDefinitionItem, {
            connection,
            dvelopId: objectDefinitionId,
          })
        : null;
      const existing = await this.em.findOne(DvelopPropertyItem, {
        connection,
        objectDefinition,
        dvelopId,
      });
      const values = {
        connection,
        objectDefinition,
        dvelopId,
        title: normalizeString(item.title) ?? dvelopId,
        dataType: normalizeString(item.dataType),
        description: normalizeString(item.description),
        isRequired: item.isRequired === true,
        isMultiValue: item.isMultiValue === true,
        isActive: item.isActive !== false,
        lastSyncedAt: now,
      };

      if (existing) {
        this.em.assign(existing, values);
        summary.updated += 1;
      } else {
        this.em.persist(this.em.create(DvelopPropertyItem, values));
        summary.created += 1;
      }
    }

    return summary;
  }
}

function createSummary(items: unknown[]): DvelopSyncSummary {
  return {
    total: Array.isArray(items) ? items.length : 0,
    created: 0,
    updated: 0,
    skipped: 0,
  };
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}
