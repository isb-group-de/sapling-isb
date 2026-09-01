import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EntityManager, RequiredEntityData } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { EntityRouteItem } from '../../entity/EntityRouteItem';
import { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { ScriptResultServerMethods } from '../../script/core/script.result.server';
import { ScriptMethods, ScriptService } from '../script/script.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericFilterService } from './generic-filter.service';
import {
  buildErrorDiagnostics,
  buildForeignKeyViolationDiagnostics,
} from '../common/error-diagnostics.util';
import { normalizeSaplingPhonePayload } from '../common/sapling-phone.util';
import { getEntityHandleByTableName } from '../common/entity-table-name.util';
import { assertGenericDateRanges } from './generic-date-range.util';

@Injectable()
export class GenericMutationService {
  constructor(
    private readonly em: EntityManager,
    private readonly scriptService: ScriptService,
    private readonly genericFilterService: GenericFilterService,
  ) {}

  async applyBeforeScript<T extends Record<string, any>>(
    method: ScriptMethods,
    data: T,
    entity: EntityItem | null,
    currentUser: PersonItem,
    context: ScriptServerContext = {},
  ): Promise<T> {
    if (!entity) {
      return data;
    }

    const script = await this.scriptService.runServer(
      method,
      data,
      entity,
      currentUser,
      context,
    );

    if (script.method === ScriptResultServerMethods.overwrite) {
      return script.items[0] as T;
    }

    return data;
  }

  async applyAfterScript<T extends object>(
    method: ScriptMethods,
    data: T,
    entity: EntityItem | null,
    currentUser: PersonItem,
    context: ScriptServerContext = {},
  ): Promise<T> {
    if (!entity) {
      return data;
    }

    const script = await this.scriptService.runServer(
      method,
      data,
      entity,
      currentUser,
      context,
    );

    if (script.method === ScriptResultServerMethods.overwrite) {
      const overwritten = script.items[0] as T;

      if (overwritten === data) {
        return (
          Array.isArray(overwritten) ? [...overwritten] : { ...overwritten }
        ) as T;
      }

      return overwritten;
    }

    return data;
  }

  async createAndFlush<T extends Record<string, any>>(
    entityHandle: string,
    entityClass: unknown,
    data: T,
    template: EntityTemplateDto[] = [],
  ): Promise<object> {
    assertGenericDateRanges(template, data);
    return this.runPersistence(entityHandle, 'create', async () => {
      const normalizedData = this.genericFilterService.normalizeDatePayload(
        normalizeSaplingPhonePayload(
          template,
          await this.applyDefaultFavoriteRoute(entityHandle, data),
        ),
        template,
      );
      const created = this.em.create(
        entityClass as never,
        normalizedData as RequiredEntityData<object>,
      );
      await this.em.flush();
      return created;
    });
  }

  async assignAndFlush<T extends Record<string, any>>(
    entityHandle: string,
    item: object,
    data: T,
    template: EntityTemplateDto[] = [],
  ): Promise<object> {
    assertGenericDateRanges(template, data, item as Record<string, unknown>);
    return this.runPersistence(entityHandle, 'update', async () => {
      const normalizedData = this.genericFilterService.normalizeDatePayload(
        normalizeSaplingPhonePayload(
          template,
          await this.applyDefaultFavoriteRoute(entityHandle, data),
        ),
        template,
      );
      const updated = this.em.assign(item, normalizedData as never);
      await this.em.flush();
      return updated;
    });
  }

  async deleteAndFlush(
    entityHandle: string,
    entityClass: unknown,
    where: object,
  ): Promise<number> {
    return this.runPersistence(entityHandle, 'delete', async () =>
      this.em.nativeDelete(entityClass as never, where as never),
    );
  }

  private async runPersistence<T>(
    entityHandle: string,
    operationName: 'create' | 'update' | 'delete',
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const diagnostics = buildErrorDiagnostics(error);
      global.log.error(`entity ${entityHandle}:`, diagnostics);

      const foreignKeyViolation = buildForeignKeyViolationDiagnostics(error);
      if (foreignKeyViolation) {
        const referencingTable =
          foreignKeyViolation.referencingTable ?? foreignKeyViolation.table;
        const referencingEntityHandle =
          getEntityHandleByTableName(referencingTable);
        const summaryKey = this.getReferenceConflictMessage(
          operationName,
          Boolean(referencingEntityHandle),
        );
        const summaryParams = referencingEntityHandle
          ? { entityHandle: referencingEntityHandle }
          : undefined;

        throw new ConflictException({
          message: this.getPersistenceErrorMessage(operationName),
          error: summaryKey,
          details: {
            summary: summaryKey,
            summaryKey,
            summaryParams,
            entityHandle,
            referencingEntityHandle,
          },
          technical: {
            operation: `generic.${operationName}`,
            entityHandle,
            exception: foreignKeyViolation,
          },
        });
      }

      if (error instanceof Error) {
        const summaryKey = `exception.${operationName}PersistenceFailed`;

        throw new BadRequestException({
          message: this.getPersistenceErrorMessage(operationName),
          error: summaryKey,
          details: {
            summary: summaryKey,
            summaryKey,
            entityHandle,
          },
          technical: {
            operation: `generic.${operationName}`,
            entityHandle,
            exception: diagnostics,
          },
        });
      }

      throw error;
    }
  }

  private getReferenceConflictMessage(
    operationName: 'create' | 'update' | 'delete',
    hasReferencingEntity: boolean,
  ): string {
    const action = operationName === 'delete' ? 'delete' : 'save';
    const suffix = hasReferencingEntity
      ? 'ReferencedRecord'
      : 'ReferencedRecordGeneric';

    return `exception.${action}${suffix}`;
  }

  private getPersistenceErrorMessage(
    operationName: 'create' | 'update' | 'delete',
  ): string {
    switch (operationName) {
      case 'create':
        return 'global.createError';
      case 'update':
        return 'global.updateError';
      case 'delete':
        return 'global.deleteError';
    }
  }

  private async applyDefaultFavoriteRoute<T extends Record<string, any>>(
    entityHandle: string,
    data: T,
  ): Promise<T> {
    if (
      (entityHandle !== 'favorite' && entityHandle !== 'favoriteTemplate') ||
      data.entityRoute != null
    ) {
      return data;
    }

    const relatedEntityHandle = this.extractFavoriteEntityHandle(data.entity);

    if (!relatedEntityHandle) {
      return data;
    }

    const entityRoute = await this.em.findOne(EntityRouteItem, {
      entity: { handle: relatedEntityHandle },
      route: `table/${relatedEntityHandle}`,
    });

    if (!entityRoute?.handle) {
      return data;
    }

    return {
      ...data,
      entityRoute: entityRoute.handle,
    };
  }

  private extractFavoriteEntityHandle(entity: unknown): string | null {
    if (typeof entity === 'string' && entity.trim().length > 0) {
      return entity.trim();
    }

    if (
      entity &&
      typeof entity === 'object' &&
      typeof (entity as { handle?: unknown }).handle === 'string'
    ) {
      return (entity as { handle: string }).handle.trim();
    }

    return null;
  }
}
