import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import { DvelopRepositoryItem } from '../../entity/DvelopRepositoryItem';
import { DvelopCloudClientService } from './dvelop-cloud-client.service';
import { DvelopCloudMetadataService } from './dvelop-cloud-metadata.service';
import { DvelopConfigurationImportService } from './dvelop-configuration-import.service';
import type {
  DvelopCloudRecord,
  DvelopConfigurationImportPayload,
  DvelopConfigurationImportResponse,
  DvelopConfigurationSyncPayload,
  DvelopHealthCheckCapability,
  DvelopHealthCheckCapabilityKey,
  DvelopHealthCheckResponse,
  DvelopHealthCheckStatus,
  DvelopImportedRepository,
  DvelopSyncSummary,
} from './dvelop-configuration.types';

export type {
  DvelopConfigurationImportPayload,
  DvelopConfigurationImportResponse,
  DvelopConfigurationSyncPayload,
  DvelopHealthCheckCapability,
  DvelopHealthCheckCapabilityKey,
  DvelopHealthCheckResponse,
  DvelopHealthCheckStatus,
  DvelopImportedObjectDefinition,
  DvelopImportedProperty,
  DvelopImportedRepository,
} from './dvelop-configuration.types';

@Injectable()
export class DvelopConfigurationService {
  private readonly client: DvelopCloudClientService;
  private readonly metadata: DvelopCloudMetadataService;
  private readonly importer: DvelopConfigurationImportService;

  constructor(
    private readonly em: EntityManager,
    @Optional() client?: DvelopCloudClientService,
    @Optional() metadata?: DvelopCloudMetadataService,
    @Optional() importer?: DvelopConfigurationImportService,
  ) {
    this.client = client ?? new DvelopCloudClientService();
    this.metadata = metadata ?? new DvelopCloudMetadataService(this.client);
    this.importer =
      importer ?? new DvelopConfigurationImportService(em, this.client);
  }

  async importConfiguration(
    connectionHandle: number,
    payload: DvelopConfigurationImportPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    return this.importer.importConfiguration(
      await this.findConnection(connectionHandle),
      payload,
    );
  }

  async syncConfiguration(
    connectionHandle: number,
    payload: DvelopConfigurationSyncPayload = {},
  ): Promise<DvelopConfigurationImportResponse> {
    const connection = await this.findConnection(connectionHandle);
    const selection = this.resolveSyncSelection(connection, payload);
    const now = new Date();
    let repositories = emptySummary();

    if (selection.repositories) {
      repositories = await this.importer.importRepositories(
        connection,
        await this.metadata.fetchRepositories(connection),
        now,
      );
      await this.em.flush();
    }

    let objectDefinitionRecords: DvelopCloudRecord[] = [];
    if (selection.objectDefinitions || selection.properties) {
      try {
        objectDefinitionRecords =
          await this.metadata.fetchObjectDefinitionRecords(connection);
      } catch (error) {
        if (selection.objectDefinitions) {
          throw error;
        }
      }
    }

    const imported = await this.importer.importConfiguration(connection, {
      objectDefinitions: selection.objectDefinitions
        ? this.metadata.normalizeObjectDefinitions(objectDefinitionRecords)
        : [],
      properties: selection.properties
        ? await this.metadata.fetchProperties(
            connection,
            objectDefinitionRecords,
          )
        : [],
    });

    return {
      repositories,
      objectDefinitions: imported.objectDefinitions,
      properties: imported.properties,
    };
  }

  async healthCheckConfiguration(
    connectionHandle: number,
  ): Promise<DvelopHealthCheckResponse> {
    const connection = await this.findConnection(connectionHandle);
    const capabilities: DvelopHealthCheckCapability[] = [
      this.checkLocalConfiguration(connection),
    ];
    let healthConnection = connection;
    let objectDefinitionRecords: DvelopCloudRecord[] = [];

    const repositoryCapability = await this.checkCloudCapability<
      DvelopImportedRepository[]
    >('repositories', async () => this.metadata.fetchRepositories(connection));
    capabilities.push(repositoryCapability.capability);

    if (repositoryCapability.result) {
      const repository = this.resolveHealthRepository(
        connection,
        repositoryCapability.result,
      );
      if (repository) {
        healthConnection = { ...connection, repository };
      }
    }

    const objectDefinitionCapability = await this.checkCloudCapability<
      DvelopCloudRecord[]
    >('objectDefinitions', async () => {
      objectDefinitionRecords =
        await this.metadata.fetchObjectDefinitionRecords(healthConnection);
      return objectDefinitionRecords;
    });
    capabilities.push(objectDefinitionCapability.capability);

    const propertiesCapability = await this.checkCloudCapability(
      'properties',
      async () => {
        const records =
          objectDefinitionRecords.length > 0
            ? objectDefinitionRecords
            : await this.metadata.fetchObjectDefinitionRecords(
                healthConnection,
              );
        return this.metadata.fetchProperties(healthConnection, records);
      },
    );
    capabilities.push(propertiesCapability.capability);

    return {
      status: this.resolveHealthStatus(capabilities),
      checkedAt: new Date().toISOString(),
      connectionHandle,
      repositoryId: this.client.getRepositoryId(healthConnection),
      capabilities,
    };
  }

  private resolveSyncSelection(
    connection: DvelopConnectionItem,
    payload: DvelopConfigurationSyncPayload,
  ): {
    repositories: boolean;
    objectDefinitions: boolean;
    properties: boolean;
  } {
    const hasExplicitSelection =
      payload.repositories === true ||
      payload.objectDefinitions === true ||
      payload.properties === true;
    const needsRepository =
      payload.objectDefinitions === true || payload.properties === true;
    const selection = {
      repositories: hasExplicitSelection
        ? payload.repositories === true ||
          (needsRepository && !this.client.getRepositoryId(connection))
        : true,
      objectDefinitions: hasExplicitSelection
        ? payload.objectDefinitions === true || payload.properties === true
        : true,
      properties: hasExplicitSelection ? payload.properties === true : true,
    };

    if (
      !selection.repositories &&
      !selection.objectDefinitions &&
      !selection.properties
    ) {
      throw new BadRequestException('global.invalidPayload');
    }

    return selection;
  }

  private async findConnection(
    connectionHandle: number,
  ): Promise<DvelopConnectionItem> {
    if (!Number.isFinite(connectionHandle)) {
      throw new BadRequestException('global.invalidPayload');
    }

    const connection = await this.em.findOne(
      DvelopConnectionItem,
      { handle: connectionHandle },
      { populate: ['repository'] },
    );
    if (!connection) {
      throw new NotFoundException('document.dvelopConnectionNotFound');
    }
    return connection;
  }

  private checkLocalConfiguration(
    connection: DvelopConnectionItem,
  ): DvelopHealthCheckCapability {
    try {
      this.client.validateConnection(connection);
      return {
        key: 'apiKey',
        status: 'success',
        message: 'document.dvelopHealthApiKeyConfigured',
      };
    } catch (error) {
      return {
        key: 'apiKey',
        status: 'error',
        message: this.getHealthErrorMessage(error),
      };
    }
  }

  private async checkCloudCapability<T extends unknown[]>(
    key: DvelopHealthCheckCapabilityKey,
    run: () => Promise<T>,
  ): Promise<{ capability: DvelopHealthCheckCapability; result: T | null }> {
    try {
      const result = await run();
      const count = result.length;
      return {
        result,
        capability: {
          key,
          status: count > 0 ? 'success' : 'warning',
          count,
          message:
            count > 0
              ? 'document.dvelopHealthCapabilityAvailable'
              : 'document.dvelopHealthCapabilityEmpty',
        },
      };
    } catch (error) {
      return {
        result: null,
        capability: {
          key,
          status: 'error',
          message: this.getHealthErrorMessage(error),
        },
      };
    }
  }

  private resolveHealthRepository(
    connection: DvelopConnectionItem,
    repositories: DvelopImportedRepository[],
  ): DvelopRepositoryItem | null {
    const currentRepositoryId = this.client.getRepositoryId(connection);
    const selected =
      repositories.find(
        (repository) => repository.dvelopId === currentRepositoryId,
      ) ??
      repositories.find((repository) => repository.isDefault === true) ??
      repositories[0];

    return selected?.dvelopId
      ? ({
          dvelopId: selected.dvelopId,
          title: selected.title ?? selected.dvelopId,
        } as DvelopRepositoryItem)
      : null;
  }

  private resolveHealthStatus(
    capabilities: DvelopHealthCheckCapability[],
  ): DvelopHealthCheckStatus {
    if (capabilities.some((capability) => capability.status === 'error')) {
      return 'error';
    }
    if (capabilities.some((capability) => capability.status === 'warning')) {
      return 'warning';
    }
    return 'success';
  }

  private getHealthErrorMessage(error: unknown): string {
    return error instanceof Error && error.message.trim()
      ? error.message
      : this.client.getErrorMessage(error);
  }
}

function emptySummary(): DvelopSyncSummary {
  return { total: 0, created: 0, updated: 0, skipped: 0 };
}
