import { BadRequestException, Injectable } from '@nestjs/common';
import type { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { FieldPermissionService } from '../current/field-permission.service';
import {
  extractImportHandle,
  getImportErrorMessage,
  hasImportableRowValues,
  normalizeImportRow,
  omitImportHandle,
  type GenericImportResponse,
  type GenericImportRowResult,
} from './generic-import.util';
import type { GenericUpdateConcurrencyOptions } from './generic-update-conflict.service';

type CreateRecord = (
  entityHandle: string,
  data: Record<string, unknown>,
  currentUser: PersonItem,
  scriptContext: ScriptServerContext,
) => Promise<object>;

type UpdateRecord = (
  entityHandle: string,
  handle: string | number,
  data: Record<string, unknown>,
  currentUser: PersonItem,
  relations: string[],
  scriptContext: ScriptServerContext,
  concurrency: GenericUpdateConcurrencyOptions,
) => Promise<object>;

@Injectable()
export class GenericImportRowsService {
  constructor(private readonly fieldPermissions: FieldPermissionService) {}

  async execute(
    entityHandle: string,
    rows: Record<string, unknown>[],
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    createRecord: CreateRecord,
    updateRecord: UpdateRecord,
  ): Promise<GenericImportResponse> {
    if (!Array.isArray(rows)) {
      throw new BadRequestException('global.invalidPayload');
    }
    const template = await this.fieldPermissions.getTemplates(entityHandle);
    const results: GenericImportRowResult[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      if (!hasImportableRowValues(row)) {
        results.push({ rowNumber, action: 'skipped' });
        continue;
      }
      let handle: string | number | null = extractImportHandle(row);
      try {
        await this.assertPayloadAccess(
          currentUser,
          entityHandle,
          row,
          handle,
          template,
        );
        const payload = normalizeImportRow(template, row);
        handle = extractImportHandle(payload);
        const writablePayload = omitImportHandle(payload);
        if (handle == null) {
          const created = await createRecord(
            entityHandle,
            writablePayload,
            currentUser,
            scriptContext,
          );
          results.push({
            rowNumber,
            action: 'created',
            handle: extractEntityHandle(created),
          });
        } else {
          const updated = await updateRecord(
            entityHandle,
            handle,
            writablePayload,
            currentUser,
            [],
            scriptContext,
            { resolution: 'overwrite' },
          );
          results.push({
            rowNumber,
            action: 'updated',
            handle: extractEntityHandle(updated) ?? handle,
          });
        }
      } catch (error) {
        results.push({
          rowNumber,
          action: 'failed',
          handle,
          message: getImportErrorMessage(error),
        });
      }
    }
    return summarizeImportRows(rows.length, results);
  }

  private assertPayloadAccess(
    currentUser: PersonItem,
    entityHandle: string,
    row: Record<string, unknown>,
    handle: string | number | null,
    template: EntityTemplateDto[],
  ): Promise<void> {
    return this.fieldPermissions.assertPayloadAccess(
      currentUser,
      entityHandle,
      omitImportHandle(row),
      handle == null ? 'insert' : 'update',
      undefined,
      template,
    );
  }
}

function summarizeImportRows(
  totalRows: number,
  rows: GenericImportRowResult[],
): GenericImportResponse {
  return {
    totalRows,
    created: rows.filter((result) => result.action === 'created').length,
    updated: rows.filter((result) => result.action === 'updated').length,
    skipped: rows.filter((result) => result.action === 'skipped').length,
    failed: rows.filter((result) => result.action === 'failed').length,
    rows,
  };
}

function extractEntityHandle(item: object): string | number | null {
  const handle = (item as { handle?: unknown }).handle;
  return typeof handle === 'string' || typeof handle === 'number'
    ? handle
    : null;
}
