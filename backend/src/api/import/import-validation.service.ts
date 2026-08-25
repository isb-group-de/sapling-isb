import { EntityManager, RequestContext } from '@mikro-orm/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ExternalRecordLinkItem } from '../../entity/ExternalRecordLinkItem';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { ImportSourceItem } from '../../entity/ImportSourceItem';
import { PersonItem } from '../../entity/PersonItem';
import { FieldPermissionService } from '../current/field-permission.service';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import {
  extractImportHandle,
  getImportErrorMessage,
  omitImportHandle,
} from '../generic/generic-import.util';
import { TemplateService } from '../template/template.service';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type {
  ConfigureImportBatchDto,
  ImportFieldDefaultDto,
  ImportFieldMappingDto,
  ImportGenericReferenceMappingDto,
  ImportRelationMappingDto,
  ImportUniqueConflictStrategyDto,
  ImportValueMappingDto,
} from './import.types';
import { ImportBatchQueryService } from './import-batch-query.service';
import { ImportFieldValidationService } from './import-field-validation.service';
import { ImportPayloadService } from './import-payload.service';
import { ImportReferenceResolverService } from './import-reference-resolver.service';
import { ImportUniqueConflictService } from './import-unique-conflict.service';

type ImportPlannedAction = {
  action: string;
  targetReference: string | number | null;
};

const IMPORT_PROGRESS_FLUSH_INTERVAL = 25;

@Injectable()
export class ImportValidationService {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericCustomFieldService: GenericCustomFieldService,
    private readonly importPayloadService: ImportPayloadService,
    private readonly importReferenceResolverService: ImportReferenceResolverService,
    private readonly importUniqueConflictService: ImportUniqueConflictService,
    private readonly importFieldValidationService: ImportFieldValidationService,
    private readonly importBatchQueryService: ImportBatchQueryService,
    private readonly fieldPermissions: FieldPermissionService = {
      applyTemplateAccess: (
        _user: PersonItem,
        _entityHandle: string,
        templates: EntityTemplateDto[],
      ): EntityTemplateDto[] => templates,
      assertPayloadAccess: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  async processQueuedValidation(
    handle: number,
    userHandle: number,
  ): Promise<void> {
    await this.runInImportContext(async () => {
      const batch = await this.importBatchQueryService.tryFindBatch(handle);
      if (!batch) {
        return;
      }

      if (
        batch.status !== 'validationQueued' &&
        batch.status !== 'validating'
      ) {
        return;
      }

      try {
        await this.validateBatch(batch, userHandle);
      } catch (error) {
        await this.markBatchJobFailed(handle, error);
        throw error;
      }
    });
  }

  private async validateBatch(
    batch: ImportBatchItem,
    userHandle: number,
  ): Promise<void> {
    const currentUser = await this.findImportUser(userHandle);
    const entityHandle = this.extractHandle(batch.targetEntity);
    if (!entityHandle) {
      throw new BadRequestException('import.targetEntityRequired');
    }

    const sourceHandle = this.extractHandle(batch.source);
    const source = sourceHandle
      ? ({ handle: sourceHandle } as ImportSourceItem)
      : null;
    const keyColumns = this.normalizeColumns(batch.externalKeyColumns ?? []);
    const effectiveDto = this.createConfigureDtoFromBatch(batch);
    const rows = await this.em.find(
      ImportBatchRowItem,
      { batch: { handle: batch.handle } },
      { orderBy: { rowNumber: 'ASC' } },
    );
    const template = this.fieldPermissions.applyTemplateAccess(
      currentUser,
      entityHandle,
      await this.genericCustomFieldService.appendCustomFieldTemplates(
        entityHandle,
        this.templateService.getEntityTemplate(entityHandle),
      ),
    );
    const duplicateKeys = new Set<string>();
    const uniqueValueClaims = new Map<string, number>();
    let readyCount = 0;
    let errorCount = 0;

    batch.status = 'validating';
    batch.currentOperation = 'validation';
    batch.processedCount = 0;
    batch.readyCount = 0;
    batch.errorCount = 0;
    batch.startedAt = new Date();
    batch.completedAt = null;
    batch.failedAt = null;
    batch.lastError = null;
    await this.em.flush();

    for (const row of rows) {
      try {
        const externalKey =
          source && keyColumns.length > 0
            ? this.importReferenceResolverService.buildExternalKey(
                source.handle,
                entityHandle,
                keyColumns,
                row.rawData,
              )
            : null;

        if (externalKey) {
          if (duplicateKeys.has(externalKey.hash)) {
            throw new BadRequestException('import.duplicateExternalKeyInBatch');
          }
          duplicateKeys.add(externalKey.hash);
        }

        const payload = await this.importPayloadService.buildPayload(
          template,
          row.rawData,
          effectiveDto,
          currentUser,
        );
        this.importFieldValidationService.validatePrimitiveValues(
          template,
          payload,
        );
        const plannedAction = await this.resolvePlannedAction(
          entityHandle,
          payload,
          source?.handle ?? null,
          externalKey?.hash ?? null,
        );
        await this.importUniqueConflictService.applyStrategies(
          template,
          payload,
          effectiveDto,
          entityHandle,
          row,
          plannedAction.targetReference,
          externalKey,
          uniqueValueClaims,
        );
        await this.fieldPermissions.assertPayloadAccess(
          currentUser,
          entityHandle,
          omitImportHandle(payload),
          plannedAction.action === 'updated' ? 'update' : 'insert',
        );

        const missingRequiredFields =
          this.importFieldValidationService.getMissingRequiredFieldNames(
            template,
            payload,
            plannedAction.action,
          );
        if (plannedAction.action !== 'updated') {
          missingRequiredFields.push(
            ...(await this.genericCustomFieldService.getMissingRequiredFieldNames(
              entityHandle,
              this.normalizeRecord(payload.customFields) ?? {},
            )),
          );
        }

        if (missingRequiredFields.length > 0) {
          throw new Error(
            this.importFieldValidationService.createRequiredFieldsMissingMessage(
              missingRequiredFields,
            ),
          );
        }

        row.payload = payload;
        row.externalKeyHash = externalKey?.hash ?? null;
        row.externalKeyParts = externalKey?.parts ?? null;
        row.action = plannedAction.action;
        row.status = 'ready';
        row.message = null;
        readyCount += 1;
      } catch (error) {
        row.payload = null;
        row.externalKeyHash = null;
        row.externalKeyParts = null;
        row.action = null;
        row.status = 'error';
        row.message = getImportErrorMessage(error);
        errorCount += 1;
      }

      batch.processedCount += 1;
      batch.readyCount = readyCount;
      batch.errorCount = errorCount;
      if (batch.processedCount % IMPORT_PROGRESS_FLUSH_INTERVAL === 0) {
        await this.em.flush();
      }
    }

    batch.readyCount = readyCount;
    batch.errorCount = errorCount;
    batch.status = errorCount > 0 ? 'validatedWithErrors' : 'validated';
    batch.currentOperation = null;
    batch.completedAt = new Date();
    await this.em.flush();
  }

  private async runInImportContext<T>(callback: () => Promise<T>): Promise<T> {
    return RequestContext.create(this.em.fork(), callback);
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
          'roles.permissions.fieldPermissions',
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
    const batch = await this.importBatchQueryService.tryFindBatch(handle);
    if (!batch) {
      return;
    }

    batch.status = 'validationFailed';
    batch.currentOperation = 'validation';
    batch.failedAt = new Date();
    batch.completedAt = null;
    batch.lastError = getImportErrorMessage(error);
    await this.em.flush();
  }

  private createConfigureDtoFromBatch(
    batch: ImportBatchItem,
  ): ConfigureImportBatchDto {
    const mapping = this.normalizeRecord(batch.mapping) ?? {};

    return {
      entityHandle: this.normalizeRequiredString(
        this.extractHandle(batch.targetEntity),
      ),
      sourceHandle: this.extractHandle(batch.source),
      templateHandle: this.extractNumericHandle(batch.importTemplate),
      keyColumns: this.normalizeColumns(batch.externalKeyColumns ?? []),
      mappings: this.asImportRecordArray<ImportFieldMappingDto>(
        mapping.mappings,
      ),
      fieldDefaults: this.asImportRecordArray<ImportFieldDefaultDto>(
        mapping.fieldDefaults,
      ),
      relationMappings: this.asImportRecordArray<ImportRelationMappingDto>(
        mapping.relationMappings,
      ),
      valueMappings: this.asImportRecordArray<ImportValueMappingDto>(
        mapping.valueMappings,
      ),
      uniqueConflictStrategies:
        this.asImportRecordArray<ImportUniqueConflictStrategyDto>(
          mapping.uniqueConflictStrategies,
        ),
      genericReferenceMapping:
        this.normalizeGenericReferenceMapping(batch.genericReferenceMapping) ??
        null,
    };
  }

  private asImportRecordArray<T>(value: unknown): T[] {
    return Array.isArray(value)
      ? (value.filter((entry) => entry && typeof entry === 'object') as T[])
      : [];
  }

  private normalizeGenericReferenceMapping(
    value: unknown,
  ): ImportGenericReferenceMappingDto | null {
    const record = this.normalizeRecord(value);
    if (!record) {
      return null;
    }

    const entityHandle = this.normalizeOptionalString(record.entityHandle);
    if (!entityHandle) {
      return null;
    }

    return {
      entityHandle,
      sourceHandle: this.normalizeOptionalString(record.sourceHandle),
      keyColumns: this.normalizeColumns(
        Array.isArray(record.keyColumns)
          ? record.keyColumns.filter(
              (column): column is string => typeof column === 'string',
            )
          : [],
      ),
    };
  }

  private async resolvePlannedAction(
    entityHandle: string,
    payload: Record<string, unknown>,
    sourceHandle: string | null,
    externalKeyHash: string | null,
  ): Promise<ImportPlannedAction> {
    if (sourceHandle && externalKeyHash) {
      const link = await this.em.findOne(ExternalRecordLinkItem, {
        source: { handle: sourceHandle },
        entity: { handle: entityHandle },
        externalKeyHash,
      });

      return {
        action: link ? 'updated' : 'created',
        targetReference: link?.reference ?? null,
      };
    }

    const payloadHandle = extractImportHandle(payload);
    return {
      action: payloadHandle == null ? 'created' : 'updated',
      targetReference: payloadHandle,
    };
  }

  private normalizeColumns(columns: string[]): string[] {
    return Array.from(
      new Set(columns.map((column) => column.trim()).filter(Boolean)),
    );
  }

  private normalizeRequiredString(value: unknown): string {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      throw new BadRequestException('exception.badRequest');
    }
    return normalized;
  }

  private normalizeOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private normalizeRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private extractHandle(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' ? handle : null;
  }

  private extractNumericHandle(value: unknown): number | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'number' ? handle : null;
  }
}
