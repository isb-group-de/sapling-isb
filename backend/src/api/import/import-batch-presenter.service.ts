import { Injectable } from '@nestjs/common';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import type {
  ImportBatchResultSummaryDto,
  ImportBatchRowSummaryDto,
  ImportBatchSummaryDto,
} from './import.types';

@Injectable()
export class ImportBatchPresenterService {
  toBatchSummary(
    batch: ImportBatchItem,
    rows: ImportBatchRowItem[],
  ): ImportBatchSummaryDto {
    return {
      handle: batch.handle ?? null,
      status: batch.status,
      currentOperation: batch.currentOperation ?? null,
      filename: batch.filename,
      mimetype: batch.mimetype ?? null,
      fileSize: batch.fileSize ?? null,
      sourceHandle: this.extractHandle(batch.source),
      entityHandle: this.extractHandle(batch.targetEntity),
      templateHandle: this.extractNumericHandle(batch.importTemplate),
      rowCount: batch.rowCount ?? rows.length,
      processedCount: batch.processedCount,
      readyCount: batch.readyCount,
      errorCount: batch.errorCount,
      createdCount: batch.createdCount,
      updatedCount: batch.updatedCount,
      skippedCount: batch.skippedCount,
      failedCount: batch.failedCount,
      delimiter: batch.delimiter ?? null,
      headers: batch.headers ?? [],
      sampleRows: batch.sampleRows ?? [],
      mapping: batch.mapping ?? null,
      externalKeyColumns: batch.externalKeyColumns ?? null,
      genericReferenceMapping: batch.genericReferenceMapping ?? null,
      jobId: batch.jobId ?? null,
      startedAt: batch.startedAt ?? null,
      executedAt: batch.executedAt ?? null,
      completedAt: batch.completedAt ?? null,
      failedAt: batch.failedAt ?? null,
      lastError: batch.lastError ?? null,
      createdAt: batch.createdAt ?? null,
      updatedAt: batch.updatedAt ?? null,
      resultSummary: this.toResultSummary(batch),
      rows: rows.map((row) => this.toRowSummary(row)),
    };
  }

  toRowSummary(row: ImportBatchRowItem): ImportBatchRowSummaryDto {
    return {
      handle: row.handle ?? null,
      rowNumber: row.rowNumber,
      status: row.status,
      action: row.action ?? null,
      targetReference: row.targetReference ?? null,
      externalKeyHash: row.externalKeyHash ?? null,
      externalKeyParts: row.externalKeyParts ?? null,
      rawData: row.rawData,
      payload: row.payload ?? null,
      message: row.message ?? null,
    };
  }

  private toResultSummary(batch: ImportBatchItem): ImportBatchResultSummaryDto {
    return {
      totalRows: batch.rowCount ?? 0,
      processedRows: batch.processedCount ?? 0,
      readyRows: batch.readyCount ?? 0,
      errorRows: batch.errorCount ?? 0,
      createdRows: batch.createdCount ?? 0,
      updatedRows: batch.updatedCount ?? 0,
      skippedRows: batch.skippedCount ?? 0,
      failedRows: batch.failedCount ?? 0,
    };
  }

  private extractHandle(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' ? handle : null;
  }

  private extractNumericHandle(value: unknown): number | null {
    if (!value || typeof value !== 'object') return null;
    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'number' ? handle : null;
  }
}
