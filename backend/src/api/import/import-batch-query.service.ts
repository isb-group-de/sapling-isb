import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import type {
  ImportBatchErrorRowsDto,
  ImportBatchSourceValuesDto,
  ImportBatchSummaryDto,
} from './import.types';
import { ImportBatchPresenterService } from './import-batch-presenter.service';

const RESPONSE_ROW_LIMIT = 200;
const OPEN_IMPORT_BATCH_STATUSES = [
  'analyzed',
  'validationQueued',
  'validating',
  'validationFailed',
  'validated',
  'validatedWithErrors',
  'executionQueued',
  'executing',
  'executionFailed',
] as const;

@Injectable()
export class ImportBatchQueryService {
  constructor(
    private readonly em: EntityManager,
    private readonly importBatchPresenterService: ImportBatchPresenterService,
  ) {}

  async getBatch(handle: number): Promise<ImportBatchSummaryDto> {
    const batch = await this.findBatch(handle);
    const rows = await this.em.find(
      ImportBatchRowItem,
      { batch: { handle } },
      { orderBy: { rowNumber: 'ASC' }, limit: RESPONSE_ROW_LIMIT },
    );

    return this.importBatchPresenterService.toBatchSummary(batch, rows);
  }

  async getBatchErrorRows(handle: number): Promise<ImportBatchErrorRowsDto> {
    await this.findBatch(handle);
    const rows = await this.em.find(
      ImportBatchRowItem,
      { batch: { handle }, status: { $in: ['error', 'failed'] } },
      { orderBy: { rowNumber: 'ASC' } },
    );

    return {
      rows: rows.map((row) =>
        this.importBatchPresenterService.toRowSummary(row),
      ),
    };
  }

  async getBatchSourceValues(
    handle: number,
    column: string,
    requestedLimit?: number,
  ): Promise<ImportBatchSourceValuesDto> {
    const batch = await this.findBatch(handle);
    const normalizedColumn = this.normalizeRequiredString(column);
    const headers = this.normalizeColumns(batch.headers ?? []);

    if (!headers.includes(normalizedColumn)) {
      throw new BadRequestException('import.sourceColumnRequired');
    }

    const requestedLimitValue =
      typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)
        ? requestedLimit
        : 100;
    const limit = Math.min(Math.max(Math.trunc(requestedLimitValue), 1), 100);
    const rows = (await this.em.getConnection().execute(
      `
        select value
        from (
          select distinct nullif(btrim(raw_data ->> ?), '') as value
          from import_batch_row_item
          where batch_handle = ?
        ) source_values
        where value is not null
        order by value asc
        limit ?
      `,
      [normalizedColumn, batch.handle, limit + 1],
    )) as Array<{ value: string }>;

    return {
      values: rows.slice(0, limit).map((row) => row.value),
      isTruncated: rows.length > limit,
    };
  }

  async listOpenBatches(): Promise<ImportBatchSummaryDto[]> {
    const batches = await this.em.find(
      ImportBatchItem,
      {
        status: { $in: [...OPEN_IMPORT_BATCH_STATUSES] },
        executedAt: null,
      },
      {
        populate: ['source', 'targetEntity', 'importTemplate', 'createdBy'],
        orderBy: { updatedAt: 'DESC' },
        limit: 100,
      },
    );

    return batches.map((batch) =>
      this.importBatchPresenterService.toBatchSummary(batch, []),
    );
  }

  async findBatch(handle: number): Promise<ImportBatchItem> {
    const batch = await this.tryFindBatch(handle);

    if (!batch) {
      throw new NotFoundException('import.batchNotFound');
    }

    return batch;
  }

  async tryFindBatch(handle: number): Promise<ImportBatchItem | null> {
    return this.em.findOne(
      ImportBatchItem,
      { handle },
      { populate: ['source', 'targetEntity', 'importTemplate', 'createdBy'] },
    );
  }

  private normalizeColumns(columns: string[]): string[] {
    return Array.from(
      new Set(columns.map((column) => column.trim()).filter(Boolean)),
    );
  }

  private normalizeRequiredString(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('exception.badRequest');
    }

    return value.trim();
  }
}
