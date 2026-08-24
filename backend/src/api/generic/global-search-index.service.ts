import { Injectable } from '@nestjs/common';
import { EntityManager, RequestContext } from '@mikro-orm/core';
import {
  GLOBAL_SEARCH_INDEX_ENTITY_HANDLE,
  GlobalSearchIndexItem,
} from '../../entity/GlobalSearchIndexItem';
import { EntityItem } from '../../entity/EntityItem';
import {
  ENTITY_MAP,
  ENTITY_REGISTRY,
} from '../../entity/global/entity.registry';
import { GLOBAL_SEARCH_INDEX_ENABLED } from '../../constants/project.constants';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericCustomFieldService } from './generic-custom-field.service';

export interface GlobalSearchIndexScope {
  entityHandle: string;
  fieldPaths: string[];
}

export interface GlobalSearchIndexCandidate {
  entityHandle: string;
  recordHandle: string;
  fieldPath: string;
  fieldValue: string;
}

export type GlobalSearchIndexRebuildState =
  'idle' | 'running' | 'completed' | 'failed';

export interface GlobalSearchIndexRebuildStatus {
  state: GlobalSearchIndexRebuildState;
  processedRecords: number;
  indexedEntities: number;
  indexedItems: number;
  currentEntityHandle: string | null;
  currentEntityProcessed: number;
  currentEntityTotal: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

type IndexField = {
  path: string;
  relationRoot?: string;
};

@Injectable()
export class GlobalSearchIndexService {
  private rebuildStatus: GlobalSearchIndexRebuildStatus = {
    state: 'idle',
    processedRecords: 0,
    indexedEntities: 0,
    indexedItems: 0,
    currentEntityHandle: null,
    currentEntityProcessed: 0,
    currentEntityTotal: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    error: null,
  };

  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericCustomFieldService: GenericCustomFieldService,
  ) {}

  isEnabled(): boolean {
    return GLOBAL_SEARCH_INDEX_ENABLED;
  }

  getRebuildStatus(): GlobalSearchIndexRebuildStatus {
    return { ...this.rebuildStatus };
  }

  startRebuild(): GlobalSearchIndexRebuildStatus {
    if (this.rebuildStatus.state === 'running') {
      return this.getRebuildStatus();
    }

    const startedAt = new Date();
    const indexedEntities = new Set<string>();
    this.rebuildStatus = {
      state: 'running',
      processedRecords: 0,
      indexedEntities: 0,
      indexedItems: 0,
      currentEntityHandle: null,
      currentEntityProcessed: 0,
      currentEntityTotal: 0,
      startedAt: startedAt.toISOString(),
      completedAt: null,
      durationMs: null,
      error: null,
    };

    void RequestContext.create(this.em, async () => {
      try {
        const result = await this.rebuildAll(
          ({ entityHandle, processed, entityProcessed, total }) => {
            indexedEntities.add(entityHandle);
            this.rebuildStatus = {
              ...this.rebuildStatus,
              processedRecords: processed,
              indexedEntities: indexedEntities.size,
              currentEntityHandle: entityHandle,
              currentEntityProcessed: entityProcessed,
              currentEntityTotal: total,
            };
          },
        );
        const completedAt = new Date();
        this.rebuildStatus = {
          ...this.rebuildStatus,
          state: 'completed',
          processedRecords: result.processed,
          indexedEntities: result.entities,
          indexedItems: result.indexedItems,
          currentEntityHandle: null,
          currentEntityProcessed: 0,
          currentEntityTotal: 0,
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedAt.getTime(),
          error: null,
        };
      } catch (error) {
        const completedAt = new Date();
        const message = this.getRebuildErrorMessage(error);
        global.log?.error?.('search index rebuild failed', { message });
        this.rebuildStatus = {
          ...this.rebuildStatus,
          state: 'failed',
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedAt.getTime(),
          error: message,
        };
      }
    });

    return this.getRebuildStatus();
  }

  async findCandidates(
    scopes: GlobalSearchIndexScope[],
    query: string,
    limit: number,
  ): Promise<GlobalSearchIndexCandidate[]> {
    const scopeWhere = scopes
      .filter((scope) => scope.fieldPaths.length > 0)
      .map((scope) => ({
        entityHandle: scope.entityHandle,
        fieldPath: { $in: scope.fieldPaths },
      }));
    if (scopeWhere.length === 0) {
      return [];
    }

    const rows = await this.em.find(
      GlobalSearchIndexItem,
      {
        $and: [
          { $or: scopeWhere },
          {
            normalizedValue: {
              $ilike: `%${this.stripLikeWildcards(query)}%`,
            },
          },
        ],
      },
      {
        limit,
        orderBy: { sourceUpdatedAt: 'DESC' },
      },
    );

    return rows
      .map((row) => ({
        entityHandle: row.entityHandle,
        recordHandle: row.recordHandle,
        fieldPath: row.fieldPath,
        fieldValue: row.fieldValue,
      }))
      .sort((left, right) => {
        const leftScore = this.candidateScore(left.fieldValue, query);
        const rightScore = this.candidateScore(right.fieldValue, query);
        return rightScore - leftScore;
      });
  }

  async reindexRecord(
    entityHandle: string,
    recordHandle: string | number,
  ): Promise<void> {
    if (
      entityHandle === GLOBAL_SEARCH_INDEX_ENTITY_HANDLE ||
      !ENTITY_MAP[entityHandle]
    ) {
      return;
    }
    const definition = await this.getIndexDefinition(entityHandle);
    if (definition.fields.length === 0) {
      await this.deleteRecord(entityHandle, recordHandle);
      return;
    }

    const entityClass = ENTITY_MAP[entityHandle] as new () => object;
    const record = (await this.em.findOne(
      entityClass,
      { handle: recordHandle },
      { populate: definition.relations as never[] },
    )) as Record<string, unknown> | null;
    if (!record) {
      await this.deleteRecord(entityHandle, recordHandle);
      return;
    }

    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      record,
    );
    const sourceUpdatedAt =
      hydrated.updatedAt instanceof Date ? hydrated.updatedAt : new Date();
    const entries = definition.fields.flatMap((field) => {
      const fieldValue = this.getTextValue(hydrated, field.path);
      if (!fieldValue) {
        return [];
      }
      return [
        {
          entityHandle,
          recordHandle: String(recordHandle),
          fieldPath: field.path,
          fieldValue,
          normalizedValue: this.normalize(fieldValue),
          sourceUpdatedAt,
        },
      ];
    });

    await this.em.transactional(async (transaction) => {
      await transaction.nativeDelete(GlobalSearchIndexItem, {
        entityHandle,
        recordHandle: String(recordHandle),
      });
      if (entries.length > 0) {
        await transaction
          .persist(
            entries.map((entry) =>
              transaction.create(GlobalSearchIndexItem, entry),
            ),
          )
          .flush();
      }
    });
  }

  async deleteRecord(
    entityHandle: string,
    recordHandle: string | number,
  ): Promise<void> {
    await this.em.nativeDelete(GlobalSearchIndexItem, {
      entityHandle,
      recordHandle: String(recordHandle),
    });
  }

  async handleUpsert(
    entityHandle: string,
    recordHandle: string | number,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    await this.reindexRecord(entityHandle, recordHandle);
    await this.reindexDependents(entityHandle, recordHandle);
  }

  async handleDelete(
    entityHandle: string,
    recordHandle: string | number,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    await this.deleteRecord(entityHandle, recordHandle);
    await this.reindexDependents(entityHandle, recordHandle);
  }

  async rebuildAll(
    onProgress?: (progress: {
      entityHandle: string;
      processed: number;
      entityProcessed: number;
      total: number;
    }) => void,
  ): Promise<{ processed: number; entities: number; indexedItems: number }> {
    const rebuildStartedAt = new Date();
    const entities = await this.em.find(
      EntityItem,
      { canRead: true, canShow: true },
      { populate: ['routes'], orderBy: { handle: 'ASC' } },
    );
    let processed = 0;
    let indexedEntities = 0;

    for (const entity of entities) {
      if (entity.handle === GLOBAL_SEARCH_INDEX_ENTITY_HANDLE) {
        continue;
      }
      const routes = entity.routes as unknown as {
        getItems?: () => unknown[];
      };
      if (
        !routes ||
        typeof routes.getItems !== 'function' ||
        routes.getItems().length === 0
      ) {
        continue;
      }
      const entityClass = ENTITY_MAP[entity.handle] as
        (new () => object) | undefined;
      if (!entityClass) continue;
      const definition = await this.getIndexDefinition(entity.handle);
      if (definition.fields.length === 0) continue;
      indexedEntities += 1;
      const total = await this.em.count(entityClass);
      const batchSize = 100;
      for (let offset = 0; offset < total; offset += batchSize) {
        const records = (await this.em.find(
          entityClass,
          {},
          {
            fields: ['handle'] as never[],
            limit: batchSize,
            offset,
            orderBy: { handle: 'ASC' },
          },
        )) as Array<{ handle?: string | number }>;
        for (const record of records) {
          if (record.handle == null) continue;
          await this.reindexRecord(entity.handle, record.handle);
          processed += 1;
        }
        onProgress?.({
          entityHandle: entity.handle,
          processed,
          entityProcessed: Math.min(offset + records.length, total),
          total,
        });
      }
    }
    await this.em.nativeDelete(GlobalSearchIndexItem, {
      updatedAt: { $lt: rebuildStartedAt },
    });
    return {
      processed,
      entities: indexedEntities,
      indexedItems: await this.em.count(GlobalSearchIndexItem),
    };
  }

  private async reindexDependents(
    targetEntityHandle: string,
    targetRecordHandle: string | number,
  ): Promise<void> {
    for (const entry of ENTITY_REGISTRY) {
      if (
        entry.name === targetEntityHandle ||
        entry.name === GLOBAL_SEARCH_INDEX_ENTITY_HANDLE
      ) {
        continue;
      }
      const template = this.templateService.getEntityTemplate(entry.name);
      const references = template.filter(
        (field) =>
          field.isReference &&
          ['m:1', '1:1'].includes(field.kind ?? '') &&
          field.referenceName === targetEntityHandle &&
          field.options?.includes('isValue'),
      );
      for (const reference of references) {
        const records = (await this.em.find(
          entry.class,
          { [reference.name]: targetRecordHandle },
          { fields: ['handle'] as never[] },
        )) as Array<{ handle?: string | number }>;
        for (const record of records) {
          if (record.handle != null) {
            await this.reindexRecord(entry.name, record.handle);
          }
        }
      }
    }
  }

  private async getIndexDefinition(entityHandle: string): Promise<{
    fields: IndexField[];
    relations: string[];
  }> {
    const baseTemplate = this.templateService.getEntityTemplate(entityHandle);
    const template =
      await this.genericCustomFieldService.appendCustomFieldTemplates(
        entityHandle,
        baseTemplate,
      );
    const fields: IndexField[] = template
      .filter((field) => this.isSearchableTextField(field))
      .map((field) => ({ path: field.name }));
    const relations = new Set<string>();

    for (const reference of template.filter(
      (field) =>
        field.isReference &&
        ['m:1', '1:1'].includes(field.kind ?? '') &&
        Boolean(field.referenceName) &&
        field.options?.includes('isValue'),
    )) {
      const referenceTemplate = this.templateService.getEntityTemplate(
        reference.referenceName,
      );
      for (const valueField of referenceTemplate.filter(
        (field) =>
          !field.isReference &&
          field.options?.includes('isValue') &&
          this.isSearchableTextField(field),
      )) {
        fields.push({
          path: `${reference.name}.${valueField.name}`,
          relationRoot: reference.name,
        });
        relations.add(reference.name);
      }
    }

    return {
      fields: [...new Map(fields.map((field) => [field.path, field])).values()],
      relations: [...relations],
    };
  }

  private isSearchableTextField(field: EntityTemplateDto): boolean {
    if (
      field.isPersistent === false ||
      field.isReference ||
      field.options?.some((option) =>
        ['isSecurity', 'isSearchExcluded', 'isSystem'].includes(option),
      )
    ) {
      return false;
    }
    const type = String(field.type ?? '').toLowerCase();
    return (
      [
        'string',
        'stringtype',
        'text',
        'texttype',
        'character varying',
        'varchar',
        'char',
        'uuid',
        'uuidtype',
      ].includes(type) ||
      (typeof field.length === 'number' && field.length > 0)
    );
  }

  private getTextValue(record: Record<string, unknown>, path: string): string {
    const value = path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
    }, record);
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalize(value: string): string {
    return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  }

  private stripLikeWildcards(value: string): string {
    return this.normalize(value).replace(/[%_]/g, '');
  }

  private candidateScore(value: string, query: string): number {
    const normalizedValue = this.normalize(value);
    const normalizedQuery = this.normalize(query);
    if (normalizedValue === normalizedQuery) return 3;
    if (normalizedValue.startsWith(normalizedQuery)) return 2;
    return normalizedValue.includes(normalizedQuery) ? 1 : 0;
  }

  private getRebuildErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'global.searchIndexUnknownError';
    }

    const firstLine = error.message.split(/\r?\n/, 1)[0] ?? '';
    const sanitized = firstLine.replace(/'(?:''|[^'])*'/g, "'[redacted]'");
    return `${error.name}: ${sanitized}`.slice(0, 500);
  }
}
