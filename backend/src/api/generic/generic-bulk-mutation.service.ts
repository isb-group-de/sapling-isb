import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { EntityManager, TransactionPropagation } from '@mikro-orm/core';
import { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import type {
  GenericBulkUpdateDto,
  GenericBulkUpdateResponseDto,
  GenericBulkUpdateTargetDto,
} from './dto/bulk-update.dto';
import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from './generic-entity-mutation.service';

/** Coordinates all-or-nothing updates across a generic entity selection. */
@Injectable()
export class GenericBulkMutationService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericEntityMutationService: GenericEntityMutationService,
  ) {}

  async updateMany(
    entityHandle: string,
    request: GenericBulkUpdateDto,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<GenericBulkUpdateResponseDto> {
    this.assertRequest(request);

    const targets = [...request.targets].sort((left, right) =>
      left.handle.localeCompare(right.handle, undefined, { numeric: true }),
    );
    const postCommitTasks: GenericPostCommitTask[] = [];
    const transactionState: {
      activeTarget: GenericBulkUpdateTargetDto | null;
    } = {
      activeTarget: null,
    };

    try {
      await this.em.transactional(
        async () => {
          for (const target of targets) {
            transactionState.activeTarget = target;
            await this.genericEntityMutationService.update(
              entityHandle,
              target.handle,
              { ...request.changes },
              currentUser,
              [],
              scriptContext,
              {
                expectedUpdatedAt: target.expectedUpdatedAt,
                resolution: 'detect',
              },
              { postCommitTasks },
            );
          }
        },
        { propagation: TransactionPropagation.REQUIRED },
      );
    } catch (error) {
      postCommitTasks.length = 0;
      this.rethrowBulkError(
        error,
        transactionState.activeTarget?.handle ?? null,
      );
    }

    this.genericEntityMutationService.schedulePostCommitTasks(postCommitTasks);

    return {
      updatedCount: request.targets.length,
      handles: request.targets.map((target) => target.handle),
    };
  }

  private assertRequest(request: GenericBulkUpdateDto): void {
    if (!request.changes || Object.keys(request.changes).length === 0) {
      throw new BadRequestException({
        message: 'global.bulkUpdateChangesRequired',
        details: { updatedCount: 0 },
      });
    }

    const handles = request.targets.map((target) => target.handle);
    if (new Set(handles).size !== handles.length) {
      throw new BadRequestException({
        message: 'global.bulkUpdateDuplicateTargets',
        details: { updatedCount: 0 },
      });
    }
  }

  private rethrowBulkError(error: unknown, failedHandle: string | null): never {
    if (error instanceof HttpException) {
      const originalResponse = error.getResponse();
      const response =
        originalResponse && typeof originalResponse === 'object'
          ? (originalResponse as Record<string, unknown>)
          : { message: originalResponse };
      const originalDetails =
        response.details && typeof response.details === 'object'
          ? (response.details as Record<string, unknown>)
          : {};

      throw new HttpException(
        {
          ...response,
          details: {
            ...originalDetails,
            failedHandle,
            updatedCount: 0,
          },
        },
        error.getStatus(),
        { cause: error },
      );
    }

    throw error;
  }
}
