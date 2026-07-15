import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from '@mikro-orm/core';
import { Queue } from 'bullmq';
import { REDIS_ENABLED } from '../../constants/project.constants';
import { EntityItem } from '../../entity/EntityItem';
import { ExternalRecordLinkItem } from '../../entity/ExternalRecordLinkItem';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { ImportSourceItem } from '../../entity/ImportSourceItem';
import { ImportTemplateItem } from '../../entity/ImportTemplateItem';
import { PersonItem } from '../../entity/PersonItem';
import { GenericService } from '../generic/generic.service';
import { getImportErrorMessage } from '../generic/generic-import.util';
import { TemplateService } from '../template/template.service';
import { parseCsvText } from './import-csv.util';
import type {
  ConfigureImportBatchDto,
  ImportAiSuggestDto,
  ImportAiSuggestionDto,
  ImportBatchErrorRowsDto,
  ImportBatchSourceValuesDto,
  ImportBatchSummaryDto,
  ImportMatchRequestDto,
  ImportMatchResponseDto,
  ImportTemplateSummaryDto,
  ImportValueMappingDto,
  SaveImportTemplateDto,
} from './import.types';
import { ImportAiSuggestionService } from './import-ai-suggestion.service';
import { ImportBatchQueryService } from './import-batch-query.service';
import { ImportExecutionService } from './import-execution.service';
import { ImportMatchingService } from './import-matching.service';
import { ImportTemplateService } from './import-template.service';
import { ImportValidationService } from './import-validation.service';

const SAMPLE_ROW_LIMIT = 5;
const IMPORT_JOB_NAMES = {
  validate: 'validate-import-batch',
  execute: 'execute-import-batch',
} as const;

@Injectable()
export class ImportService {
  constructor(
    private readonly em: EntityManager,
    private readonly importAiSuggestionService: ImportAiSuggestionService,
    private readonly genericService: GenericService,
    private readonly templateService: TemplateService,
    @InjectQueue('imports') private readonly importQueue: Queue,
    private readonly importBatchQueryService: ImportBatchQueryService,
    private readonly importValidationService: ImportValidationService,
    private readonly importTemplatePersistenceService: ImportTemplateService = new ImportTemplateService(
      em,
    ),
    private readonly importMatchingService: ImportMatchingService = new ImportMatchingService(
      em,
      genericService,
      templateService,
    ),
    private readonly importExecutionService: ImportExecutionService = new ImportExecutionService(
      em,
      genericService,
    ),
  ) {}

  async analyzeCsv(
    file: Express.Multer.File | undefined,
    currentUser: PersonItem,
  ): Promise<ImportBatchSummaryDto> {
    if (!file) {
      throw new BadRequestException('import.fileRequired');
    }

    const text = file.buffer.toString('utf8');
    const parsed = parseCsvText(text);

    if (parsed.headers.length === 0) {
      throw new BadRequestException('import.headerRequired');
    }

    const batch = new ImportBatchItem();
    if (currentUser.handle == null) {
      throw new BadRequestException('global.currentUserRequired');
    }

    batch.createdBy = { handle: currentUser.handle } as PersonItem;
    batch.filename = file.originalname;
    batch.mimetype = file.mimetype;
    batch.fileSize = file.size;
    batch.delimiter = parsed.delimiter;
    batch.headers = parsed.headers;
    batch.sampleRows = parsed.rows.slice(0, SAMPLE_ROW_LIMIT);
    batch.rowCount = parsed.rows.length;
    batch.status = 'analyzed';

    this.em.persist(batch);

    parsed.rows.forEach((rawData, index) => {
      const row = new ImportBatchRowItem();
      row.batch = batch;
      row.rowNumber = index + 2;
      row.rawData = rawData;
      row.status = 'pending';
      this.em.persist(row);
    });

    await this.em.flush();
    return this.getBatch(batch.handle ?? 0);
  }

  async getBatch(handle: number): Promise<ImportBatchSummaryDto> {
    return this.importBatchQueryService.getBatch(handle);
  }

  async getBatchErrorRows(handle: number): Promise<ImportBatchErrorRowsDto> {
    return this.importBatchQueryService.getBatchErrorRows(handle);
  }

  async getBatchSourceValues(
    handle: number,
    column: string,
    requestedLimit?: number,
  ): Promise<ImportBatchSourceValuesDto> {
    return this.importBatchQueryService.getBatchSourceValues(
      handle,
      column,
      requestedLimit,
    );
  }

  async matchBatchExistingRecords(
    handle: number,
    dto: ImportMatchRequestDto,
    currentUser: PersonItem,
  ): Promise<ImportMatchResponseDto> {
    const batch = await this.findBatch(handle);
    return this.importMatchingService.matchBatch(
      batch,
      dto,
      currentUser,
      async (row) => {
        if (!row.externalKeyHash) {
          return null;
        }
        const link = await this.findRowExternalLink(batch, row);
        return link?.reference ?? null;
      },
    );
  }

  async listOpenBatches(): Promise<ImportBatchSummaryDto[]> {
    return this.importBatchQueryService.listOpenBatches();
  }

  async configureBatch(
    handle: number,
    dto: ConfigureImportBatchDto,
    currentUser: PersonItem,
  ): Promise<ImportBatchSummaryDto> {
    if (currentUser.handle == null) {
      throw new BadRequestException('global.currentUserRequired');
    }

    const entityHandle = this.normalizeRequiredString(dto.entityHandle);
    const batch = await this.findBatch(handle);

    if (this.isImportBatchBusy(batch.status)) {
      throw new BadRequestException('import.batchJobAlreadyRunning');
    }

    const targetEntity = await this.em.findOne(EntityItem, {
      handle: entityHandle,
    });

    if (!targetEntity) {
      throw new NotFoundException('global.entityNotFound');
    }

    const sourceHandle = this.normalizeOptionalString(dto.sourceHandle);
    const source = sourceHandle
      ? await this.em.findOne(ImportSourceItem, { handle: sourceHandle })
      : null;

    if (sourceHandle && !source) {
      throw new NotFoundException('import.sourceNotFound');
    }

    const keyColumns = this.normalizeColumns(dto.keyColumns ?? []);
    if (keyColumns.length > 0 && !source) {
      throw new BadRequestException('import.sourceRequiredForExternalKey');
    }

    const templateHandle =
      typeof dto.templateHandle === 'number' &&
      Number.isFinite(dto.templateHandle)
        ? Math.trunc(dto.templateHandle)
        : null;
    const importTemplate = templateHandle
      ? await this.em.findOne(
          ImportTemplateItem,
          {
            handle: templateHandle,
            ...(source ? { source: { handle: source.handle } } : {}),
            targetEntity: { handle: entityHandle },
          },
          { populate: ['valueMappings'] },
        )
      : null;

    if (templateHandle && !importTemplate) {
      throw new NotFoundException('import.templateNotFound');
    }

    const valueMappings = importTemplate
      ? this.mergeValueMappings(
          this.getTemplateConfiguredValueMappings(importTemplate),
          dto.valueMappings ?? [],
        )
      : (dto.valueMappings ?? []);
    const effectiveDto: ConfigureImportBatchDto = {
      ...dto,
      valueMappings,
    };

    batch.targetEntity = targetEntity;
    batch.source = source;
    batch.importTemplate = importTemplate;
    batch.mapping = {
      mappings: effectiveDto.mappings ?? [],
      fieldDefaults: effectiveDto.fieldDefaults ?? [],
      relationMappings: effectiveDto.relationMappings ?? [],
      valueMappings: effectiveDto.valueMappings ?? [],
      uniqueConflictStrategies: effectiveDto.uniqueConflictStrategies ?? [],
    };
    batch.externalKeyColumns = keyColumns;
    batch.genericReferenceMapping = dto.genericReferenceMapping ?? null;
    batch.status = 'validationQueued';
    batch.currentOperation = 'validation';
    batch.processedCount = 0;
    batch.readyCount = 0;
    batch.errorCount = 0;
    batch.createdCount = 0;
    batch.updatedCount = 0;
    batch.skippedCount = 0;
    batch.failedCount = 0;
    batch.jobId = null;
    batch.startedAt = null;
    batch.completedAt = null;
    batch.failedAt = null;
    batch.executedAt = undefined;
    batch.lastError = null;
    await this.em.flush();

    await this.enqueueImportJob(
      IMPORT_JOB_NAMES.validate,
      handle,
      currentUser.handle,
    );
    return this.getBatch(handle);
  }

  async listTemplates(
    entityHandle?: string,
    sourceHandle?: string,
  ): Promise<ImportTemplateSummaryDto[]> {
    return this.importTemplatePersistenceService.listTemplates(
      entityHandle,
      sourceHandle,
    );
  }

  async createTemplate(
    dto: SaveImportTemplateDto,
  ): Promise<ImportTemplateSummaryDto> {
    return this.importTemplatePersistenceService.createTemplate(dto);
  }

  async updateTemplate(
    handle: number,
    dto: SaveImportTemplateDto,
  ): Promise<ImportTemplateSummaryDto> {
    return this.importTemplatePersistenceService.updateTemplate(handle, dto);
  }

  async suggestBatchConfiguration(
    handle: number,
    dto: ImportAiSuggestDto = {},
  ): Promise<ImportAiSuggestionDto> {
    const batch = await this.findBatch(handle);
    const entityHandle =
      this.normalizeOptionalString(dto.entityHandle) ??
      this.extractHandle(batch.targetEntity);

    if (!entityHandle) {
      throw new BadRequestException('import.targetEntityRequired');
    }

    const targetEntity = await this.em.findOne(EntityItem, {
      handle: entityHandle,
    });

    if (!targetEntity) {
      throw new NotFoundException('global.entityNotFound');
    }

    const sourceHandle =
      this.normalizeOptionalString(dto.sourceHandle) ??
      this.extractHandle(batch.source);
    if (sourceHandle) {
      const source = await this.em.findOne(ImportSourceItem, {
        handle: sourceHandle,
      });

      if (!source) {
        throw new NotFoundException('import.sourceNotFound');
      }
    }

    const headers = this.normalizeColumns(batch.headers ?? []);
    if (headers.length === 0) {
      throw new BadRequestException('import.headerRequired');
    }

    return this.importAiSuggestionService.suggestConfiguration(
      {
        entityHandle,
        sourceHandle: sourceHandle ?? null,
        headers,
        sampleRows: batch.sampleRows ?? [],
        templates: await this.listTemplates(
          entityHandle,
          sourceHandle ?? undefined,
        ),
      },
      dto,
    );
  }

  async executeBatch(
    handle: number,
    currentUser: PersonItem,
  ): Promise<ImportBatchSummaryDto> {
    if (currentUser.handle == null) {
      throw new BadRequestException('global.currentUserRequired');
    }

    const batch = await this.findBatch(handle);
    const entityHandle = this.extractHandle(batch.targetEntity);

    if (!entityHandle) {
      throw new BadRequestException('import.targetEntityRequired');
    }

    if (this.isImportBatchBusy(batch.status)) {
      throw new BadRequestException('import.batchJobAlreadyRunning');
    }

    if (
      batch.status !== 'validated' &&
      batch.status !== 'validatedWithErrors'
    ) {
      throw new BadRequestException('import.batchNotReadyForExecution');
    }

    if ((batch.readyCount ?? 0) <= 0) {
      throw new BadRequestException('import.noReadyRows');
    }

    batch.status = 'executionQueued';
    batch.currentOperation = 'execution';
    batch.processedCount = 0;
    batch.createdCount = 0;
    batch.updatedCount = 0;
    batch.skippedCount = 0;
    batch.failedCount = 0;
    batch.jobId = null;
    batch.startedAt = null;
    batch.completedAt = null;
    batch.failedAt = null;
    batch.lastError = null;
    await this.em.flush();

    await this.enqueueImportJob(
      IMPORT_JOB_NAMES.execute,
      handle,
      currentUser.handle,
    );
    return this.getBatch(handle);
  }

  async processQueuedValidation(
    handle: number,
    userHandle: number,
  ): Promise<void> {
    return this.importValidationService.processQueuedValidation(
      handle,
      userHandle,
    );
  }

  async processQueuedExecution(
    handle: number,
    userHandle: number,
  ): Promise<void> {
    return this.importExecutionService.processQueuedExecution(
      handle,
      userHandle,
    );
  }

  private async findBatch(handle: number): Promise<ImportBatchItem> {
    return this.importBatchQueryService.findBatch(handle);
  }

  private async enqueueImportJob(
    jobName: (typeof IMPORT_JOB_NAMES)[keyof typeof IMPORT_JOB_NAMES],
    batchHandle: number,
    userHandle: number,
  ): Promise<void> {
    const batch = await this.findBatch(batchHandle);

    if (REDIS_ENABLED) {
      const job = await this.importQueue.add(jobName, {
        batchHandle,
        userHandle,
      });
      batch.jobId = job?.id == null ? null : String(job.id);
      await this.em.flush();
      return;
    }

    batch.jobId = `local-${jobName}-${Date.now()}`;
    await this.em.flush();

    setTimeout(() => {
      const promise =
        jobName === IMPORT_JOB_NAMES.validate
          ? this.processQueuedValidation(batchHandle, userHandle)
          : this.processQueuedExecution(batchHandle, userHandle);

      void promise.catch((error) => {
        global.log?.error?.(
          `Import background job failed: ${getImportErrorMessage(error)}`,
        );
      });
    }, 0);
  }

  private isImportBatchBusy(status: string): boolean {
    return [
      'validationQueued',
      'validating',
      'executionQueued',
      'executing',
    ].includes(status);
  }

  private mergeValueMappings(
    baseMappings: ImportValueMappingDto[],
    overrideMappings: ImportValueMappingDto[],
  ): ImportValueMappingDto[] {
    return this.importTemplatePersistenceService.mergeValueMappings(
      baseMappings,
      overrideMappings,
    );
  }

  private getTemplateConfiguredValueMappings(
    template: ImportTemplateItem,
  ): ImportValueMappingDto[] {
    return this.importTemplatePersistenceService.getConfiguredValueMappings(
      template,
    );
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

  private extractHandle(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const handle = (value as { handle?: unknown }).handle;
    return typeof handle === 'string' ? handle : null;
  }
}
