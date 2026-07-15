import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, RequestContext } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { ExternalRecordLinkItem } from '../../entity/ExternalRecordLinkItem';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { ImportSourceItem } from '../../entity/ImportSourceItem';
import { PersonItem } from '../../entity/PersonItem';
import { GenericService } from '../generic/generic.service';
import {
  extractImportHandle,
  getImportErrorMessage,
} from '../generic/generic-import.util';

const IMPORT_PROGRESS_FLUSH_INTERVAL = 25;

@Injectable()
export class ImportExecutionService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericService: GenericService,
  ) {}

  async processQueuedExecution(
    handle: number,
    userHandle: number,
  ): Promise<void> {
    await RequestContext.create(this.em.fork(), () =>
      this.processQueuedExecutionInContext(handle, userHandle),
    );
  }

  private async processQueuedExecutionInContext(
    handle: number,
    userHandle: number,
  ): Promise<void> {
    const batch = await this.tryFindBatch(handle);
    if (!batch) {
      return;
    }

    if (batch.status !== 'executionQueued' && batch.status !== 'executing') {
      return;
    }

    try {
      const currentUser = await this.findImportUser(userHandle);
      const entityHandle = this.extractHandle(batch.targetEntity);
      if (!entityHandle) {
        throw new BadRequestException('import.targetEntityRequired');
      }

      const rows = await this.em.find(
        ImportBatchRowItem,
        { batch: { handle: batch.handle } },
        { orderBy: { rowNumber: 'ASC' } },
      );

      this.startExecution(batch);
      await this.em.flush();

      for (const row of rows) {
        await this.processRow(batch, row, entityHandle, currentUser);
        batch.processedCount += 1;
        if (batch.processedCount % IMPORT_PROGRESS_FLUSH_INTERVAL === 0) {
          await this.em.flush();
        }
      }

      batch.executedAt = new Date();
      batch.status = batch.failedCount > 0 ? 'executedWithErrors' : 'executed';
      batch.currentOperation = null;
      batch.completedAt = new Date();
      await this.em.flush();
    } catch (error) {
      await this.markBatchJobFailed(handle, error);
      throw error;
    }
  }

  private startExecution(batch: ImportBatchItem): void {
    batch.status = 'executing';
    batch.currentOperation = 'execution';
    batch.processedCount = 0;
    batch.createdCount = 0;
    batch.updatedCount = 0;
    batch.skippedCount = 0;
    batch.failedCount = 0;
    batch.startedAt = new Date();
    batch.completedAt = null;
    batch.failedAt = null;
    batch.lastError = null;
  }

  private async processRow(
    batch: ImportBatchItem,
    row: ImportBatchRowItem,
    entityHandle: string,
    currentUser: PersonItem,
  ): Promise<void> {
    if (row.status !== 'ready' || !row.payload) {
      if (row.status !== 'error') {
        row.status = 'skipped';
        row.action = 'skipped';
        batch.skippedCount += 1;
      }
      return;
    }

    try {
      const link = await this.findRowExternalLink(batch, row);
      const handleToUpdate =
        link?.reference ?? extractImportHandle(row.payload);
      const result =
        handleToUpdate == null
          ? await this.genericService.create(
              entityHandle,
              row.payload,
              currentUser,
            )
          : await this.genericService.update(
              entityHandle,
              handleToUpdate,
              row.payload,
              currentUser,
              [],
              {},
              { resolution: 'overwrite' },
            );
      const targetReference = this.extractResultHandle(result);
      const action = handleToUpdate == null ? 'created' : 'updated';

      row.status = 'executed';
      row.action = action;
      row.targetReference =
        targetReference == null ? null : String(targetReference);
      row.message = null;
      if (action === 'created') {
        batch.createdCount += 1;
      } else {
        batch.updatedCount += 1;
      }

      await this.upsertExternalLink(batch, row);
    } catch (error) {
      row.status = 'failed';
      row.action = 'failed';
      row.message = getImportErrorMessage(error);
      batch.failedCount += 1;
    }
  }

  private async tryFindBatch(handle: number): Promise<ImportBatchItem | null> {
    return this.em.findOne(
      ImportBatchItem,
      { handle },
      { populate: ['source', 'targetEntity', 'importTemplate', 'createdBy'] },
    );
  }

  private async findImportUser(userHandle: number): Promise<PersonItem> {
    const currentUser = await this.em.findOne(
      PersonItem,
      { handle: userHandle },
      {
        populate: [
          'company',
          'roles',
          'roles.stage',
          'roles.permissions',
          'roles.permissions.entity',
        ],
      },
    );

    if (!currentUser) {
      throw new BadRequestException('global.currentUserRequired');
    }
    return currentUser;
  }

  private async markBatchJobFailed(
    handle: number,
    error: unknown,
  ): Promise<void> {
    const batch = await this.tryFindBatch(handle);
    if (!batch) {
      return;
    }

    batch.status = 'executionFailed';
    batch.currentOperation = 'execution';
    batch.failedAt = new Date();
    batch.completedAt = null;
    batch.lastError = getImportErrorMessage(error);
    await this.em.flush();
  }

  private async findRowExternalLink(
    batch: ImportBatchItem,
    row: ImportBatchRowItem,
  ): Promise<ExternalRecordLinkItem | null> {
    const sourceHandle = this.extractHandle(batch.source);
    const entityHandle = this.extractHandle(batch.targetEntity);
    if (!sourceHandle || !entityHandle || !row.externalKeyHash) {
      return null;
    }

    return this.em.findOne(ExternalRecordLinkItem, {
      source: { handle: sourceHandle },
      entity: { handle: entityHandle },
      externalKeyHash: row.externalKeyHash,
    });
  }

  private async upsertExternalLink(
    batch: ImportBatchItem,
    row: ImportBatchRowItem,
  ): Promise<void> {
    const sourceHandle = this.extractHandle(batch.source);
    const entityHandle = this.extractHandle(batch.targetEntity);
    if (
      !sourceHandle ||
      !entityHandle ||
      !row.externalKeyHash ||
      !row.externalKeyParts ||
      !row.targetReference
    ) {
      return;
    }

    let link = await this.em.findOne(ExternalRecordLinkItem, {
      source: { handle: sourceHandle },
      entity: { handle: entityHandle },
      externalKeyHash: row.externalKeyHash,
    });
    if (!link) {
      link = new ExternalRecordLinkItem();
      link.source = { handle: sourceHandle } as ImportSourceItem;
      link.entity = { handle: entityHandle } as EntityItem;
      link.externalKeyHash = row.externalKeyHash;
      link.externalKeyParts = row.externalKeyParts;
      link.firstImportBatch = { handle: batch.handle } as ImportBatchItem;
      this.em.persist(link);
    }

    link.reference = row.targetReference;
    link.externalKeyParts = row.externalKeyParts;
    link.lastImportBatch = { handle: batch.handle } as ImportBatchItem;
    link.lastSeenAt = new Date();
  }

  private extractHandle(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' ? handle : null;
  }

  private extractResultHandle(value: unknown): string | number | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
