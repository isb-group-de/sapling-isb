import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TemplateService } from '../template/template.service';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { performance } from 'perf_hooks';
import { ScriptMethods } from '../script/script.service';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { ChangeLogResponseDto } from './dto/change-log-response.dto';
import { TimelineResponseDto } from './dto/timeline-response.dto';
import { GenericMutationService } from './generic-mutation.service';
import { GenericPayloadService } from './generic-payload.service';
import { GenericPermissionService } from './generic-permission.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReadService } from './generic-read.service';
import { GenericRelationService } from './generic-relation.service';
import { GenericReferenceService } from './generic-reference.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import { GenericCustomFieldService } from './generic-custom-field.service';
import { GenericOpenTaskEventsService } from './generic-open-task-events.service';
import {
  GenericTimelineService,
  TimelineDescriptorDataset,
  TimelineRecordResult,
  TimelineRelationDescriptor,
} from './generic-timeline.service';
import { GENERIC_DOWNLOAD_LIMIT } from '../../constants/project.constants';
import {
  extractImportHandle,
  getImportErrorMessage,
  hasImportableRowValues,
  normalizeImportRow,
} from './generic-import.util';
import { GenericChangeLogService } from './generic-change-log.service';
import {
  GenericUpdateConflictService,
  type GenericUpdateConcurrencyOptions,
} from './generic-update-conflict.service';
import { EmailAutomationService } from '../mail/email-automation.service';
import { normalizeSaplingPhonePayload } from '../common/sapling-phone.util';
import type {
  GenericImportResponse,
  GenericImportRowResult,
} from './generic-import.util';
export type { GenericImportResponse } from './generic-import.util';
export type { GenericUpdateConcurrencyOptions } from './generic-update-conflict.service';
type RelationMutationContext = Awaited<
  ReturnType<GenericRelationService['addReferenceAndFlush']>
>;
type InlineCollectionMutation = {
  field: EntityTemplateDto;
  items: Record<string, unknown>[];
};

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service for generic CRUD operations on entities. Handles business logic, security, and scripting for entity manipulation.
 *
 * @property        {EntityManager} em              MikroORM entity manager for database operations
 * @property        {TemplateService} templateService Service for entity templates
 * @property        {GenericQueryService} genericQueryService Service for query normalization and relation population
 * @property        {GenericReadService} genericReadService Service for read-filter, read scripts, and query execution workflows
 * @property        {GenericMutationService} genericMutationService Service for script-driven mutation and persistence workflows
 * @property        {GenericPayloadService} genericPayloadService Service for template-based payload preparation
 * @property        {GenericRelationService} genericRelationService Service for relation add/remove workflows
 * @property        {GenericPermissionService} genericPermissionService Service for permission checks and security filters
 * @property        {GenericReferenceService} genericReferenceService Service for relation handling and reference dependency validation
 * @property        {GenericSanitizerService} genericSanitizerService Service for sanitizing entity graphs and security fields
 * @property        {GenericTimelineService} genericTimelineService Service for timeline descriptors, windows, and summary composition
 *
 * @method          findAndCount     Retrieves a paginated list of entities
 * @method          downloadJSON     Downloads entity data as JSON
 * @method          create           Creates a new entry for an entity
 * @method          update           Updates an entry by its handle
 * @method          delete           Deletes an entry by its handle
 * @method          createReference  Adds references to an n:m relation
 * @method          deleteReference  Removes references from an n:m relation
 * @method          checkTopLevelPermission Checks if data manipulation is allowed
 * @method          setTopLevelFilter Applies top-level security filters
 * @method          buildPopulate    Builds the populate list for relations
 * @method          reduceReferenceFields Reduces reference fields in data
 */
@Injectable()
export class GenericService {
  // #region Constructor
  /**
   * Service constructor with dependency injection.
   * @param {EntityManager} em MikroORM entity manager
   * @param {TemplateService} templateService Service for entity templates
   * @param {GenericQueryService} genericQueryService Service for query normalization and relation population
   * @param {GenericReadService} genericReadService Service for read-filter, read scripts, and query execution workflows
   * @param {GenericMutationService} genericMutationService Service for script-driven mutation and persistence workflows
   * @param {GenericPayloadService} genericPayloadService Service for template-based payload preparation
   * @param {GenericRelationService} genericRelationService Service for relation add/remove workflows
   * @param {GenericPermissionService} genericPermissionService Service for permission checks and security filters
   * @param {GenericReferenceService} genericReferenceService Service for relation handling and reference dependency validation
   * @param {GenericSanitizerService} genericSanitizerService Service for sanitizing entity graphs and security fields
   * @param {GenericTimelineService} genericTimelineService Service for timeline descriptors, windows, and summary composition
   */
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericQueryService: GenericQueryService,
    private readonly genericReadService: GenericReadService,
    private readonly genericMutationService: GenericMutationService,
    private readonly genericPayloadService: GenericPayloadService,
    private readonly genericRelationService: GenericRelationService,
    private readonly genericPermissionService: GenericPermissionService,
    private readonly genericReferenceService: GenericReferenceService,
    private readonly genericSanitizerService: GenericSanitizerService,
    private readonly genericTimelineService: GenericTimelineService,
    private readonly genericOpenTaskEventsService: GenericOpenTaskEventsService,
    private readonly genericChangeLogService: GenericChangeLogService,
    private readonly genericUpdateConflictService: GenericUpdateConflictService,
    private readonly emailAutomationService: EmailAutomationService = {
      handleAfterInsert: (): Promise<void> => Promise.resolve(),
      handleAfterUpdate: (): Promise<void> => Promise.resolve(),
    } as unknown as EmailAutomationService,
    private readonly genericCustomFieldService: GenericCustomFieldService = {
      applyCustomFieldFilters: (
        _entityHandle: string,
        criteria: object,
      ): Promise<object> => Promise.resolve(criteria),
      hydrateRecords: <T>(_entityHandle: string, input: T): Promise<T> =>
        Promise.resolve(input),
      splitPayload: <T extends Record<string, unknown>>(payload: T) => ({
        data: payload,
        customFields: {},
      }),
      assertRequiredFields: (): Promise<void> => Promise.resolve(),
      upsertCustomFieldValues: (): Promise<void> => Promise.resolve(),
      invalidateTemplateCache: (): void => undefined,
    } as unknown as GenericCustomFieldService,
  ) {}
  // #endregion

  // #region Find / Count
  /**
   * Retrieves a paginated list of entities, applies security, and runs before/after scripts.
   * @param {string} entityHandle Name of the entity
   * @param {object} where Filter conditions
   * @param {number} page Page number
   * @param {number} limit Number of results per page
   * @param {object} orderBy Sorting conditions
   * @param {PersonItem} currentUser Current user object
   * @param {string[]} relations Relations to populate
   * @returns {Promise<{ data: object[]; meta: object }>} Paginated entity data and metadata
   */
  async findAndCount(
    entityHandle: string,
    where: object = {},
    page: number,
    limit: number,
    orderBy: object = {},
    currentUser: PersonItem,
    relations: string[] = [],
    fields: string[] = [],
  ): Promise<{
    data: object[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      executionTime: number;
    };
  }> {
    const startTime = performance.now();
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const offset = (page - 1) * limit;
    const template = this.templateService.getEntityTemplate(entityHandle);
    where = await this.genericCustomFieldService.applyCustomFieldFilters(
      entityHandle,
      where,
    );
    where = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      where,
      'filter',
    );
    orderBy = this.removeCustomFieldOrderBy(orderBy);
    orderBy = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      orderBy,
      'orderBy',
    );
    const populate = this.genericQueryService.buildPopulate(
      [
        ...relations,
        ...this.genericQueryService.collectQueryPopulateRelations(
          entityHandle,
          where,
        ),
        ...this.genericQueryService.collectQueryPopulateRelations(
          entityHandle,
          orderBy,
        ),
      ],
      template,
    );
    const selectedFields = this.genericQueryService.buildFields(
      fields,
      template,
      populate,
    );
    const result = await this.genericReadService.findAndCount(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      {
        limit,
        offset,
        orderBy,
        populate: populate as any[],
        fields: selectedFields as any[] | undefined,
      },
    );

    let items = result.items;
    const total = result.total;

    if (page == null) {
      limit = total;
      page = 1;
    }

    items = await this.genericReadService.applyAfterRead(
      items,
      result.entity,
      currentUser,
    );

    items = this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      items,
      template,
    );
    items = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      items,
    );

    const executionTime = (performance.now() - startTime) / 1000;
    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        executionTime: executionTime,
      },
    };
  }
  // #endregion

  // #region Download
  /**
   * Downloads entity data as JSON (no scripting, no count).
   * Extensible for other formats.
   * @param {string} entityHandle Name of the entity
   * @param {object} where Filter conditions
   * @param {object} orderBy Sorting conditions
   * @param {PersonItem} currentUser Current user object
   * @param {string[]} relations Relations to populate
   * @returns {Promise<string>} JSON string of entity data
   */
  async downloadJSON(
    entityHandle: string,
    where: object = {},
    orderBy: object = {},
    currentUser: PersonItem,
    relations: string[] = [],
  ): Promise<string> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const template = this.templateService.getEntityTemplate(entityHandle);
    where = await this.genericCustomFieldService.applyCustomFieldFilters(
      entityHandle,
      where,
    );
    where = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      where,
      'filter',
    );
    orderBy = this.removeCustomFieldOrderBy(orderBy);
    orderBy = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      orderBy,
      'orderBy',
    );
    const populate = this.genericQueryService.buildPopulate(
      [
        ...relations,
        ...this.genericQueryService.collectQueryPopulateRelations(
          entityHandle,
          where,
        ),
        ...this.genericQueryService.collectQueryPopulateRelations(
          entityHandle,
          orderBy,
        ),
      ],
      template,
    );
    const result = await this.genericReadService.find(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      {
        limit: GENERIC_DOWNLOAD_LIMIT + 1,
        orderBy,
        populate: populate as any[],
        runBeforeReadScript: entityHandle === 'dashboardTemplate',
      },
    );

    if (result.items.length > GENERIC_DOWNLOAD_LIMIT) {
      throw new BadRequestException('exception.exportLimitExceeded');
    }

    // Convert to JSON
    const sanitized = this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      result.items,
      template,
    );
    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      sanitized,
    );
    return JSON.stringify(hydrated, null, 2);
  }
  // #endregion

  // #region Import
  async importRows(
    entityHandle: string,
    rows: Record<string, unknown>[],
    currentUser: PersonItem,
    scriptContext: ScriptServerContext = {},
  ): Promise<GenericImportResponse> {
    if (!Array.isArray(rows)) {
      throw new BadRequestException('global.invalidPayload');
    }

    const template = this.templateService.getEntityTemplate(entityHandle);
    const results: GenericImportRowResult[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;

      if (!hasImportableRowValues(row)) {
        results.push({ rowNumber, action: 'skipped' });
        continue;
      }

      const payload = normalizeImportRow(template, row);
      const handle = extractImportHandle(payload);

      try {
        if (handle == null) {
          const created = await this.create(
            entityHandle,
            payload,
            currentUser,
            scriptContext,
          );
          results.push({
            rowNumber,
            action: 'created',
            handle: this.extractEntityHandle(created),
          });
        } else {
          const updated = await this.update(
            entityHandle,
            handle,
            payload,
            currentUser,
            [],
            scriptContext,
            { resolution: 'overwrite' },
          );
          results.push({
            rowNumber,
            action: 'updated',
            handle: this.extractEntityHandle(updated) ?? handle,
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

    return {
      totalRows: rows.length,
      created: results.filter((result) => result.action === 'created').length,
      updated: results.filter((result) => result.action === 'updated').length,
      skipped: results.filter((result) => result.action === 'skipped').length,
      failed: results.filter((result) => result.action === 'failed').length,
      rows: results,
    };
  }
  // #endregion

  // #region Timeline
  async getRecordTimeline(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    before?: string,
    months = 6,
  ): Promise<TimelineResponseDto> {
    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      entityHandle,
      handle,
    );
    const normalizedMonths = Number.isFinite(months)
      ? Math.max(1, Math.min(12, Number(months)))
      : 6;
    const mainTemplate = this.templateService.getEntityTemplate(entityHandle);
    const mainDateFields =
      this.genericTimelineService.getTimelineDateFieldConfig(mainTemplate);
    const mainRecord = await this.findTimelineRecord(
      entityHandle,
      this.genericReferenceService.getHandleFilter(
        entityHandle,
        normalizedHandle,
      ),
      mainTemplate,
      currentUser,
    );

    if (!mainRecord) {
      throw new NotFoundException('global.notFound');
    }

    const anchor = this.genericTimelineService.buildTimelineAnchor(
      entityHandle,
      normalizedHandle,
      mainRecord,
      mainTemplate,
      mainDateFields,
    );
    const cursorMonth =
      this.genericTimelineService.parseTimelineCursor(before) ??
      this.genericTimelineService.addMonths(new Date(), 1);
    const relationDescriptors =
      this.genericTimelineService.getTimelineRelationDescriptors(
        entityHandle,
        currentUser,
      );
    const datasets = await this.loadTimelineDescriptorDatasets(
      relationDescriptors,
      normalizedHandle,
      currentUser,
      cursorMonth,
    );
    const lowerBound =
      this.genericTimelineService.getTimelineLowerBound(datasets);

    const response = new TimelineResponseDto();
    response.entityHandle = entityHandle;
    response.handle = normalizedHandle;
    response.anchor = anchor;

    if (!lowerBound) {
      response.hasMore = false;
      response.nextBefore = null;
      return response;
    }

    let currentMonth = this.genericTimelineService.getMonthStart(cursorMonth);

    while (
      response.months.length < normalizedMonths &&
      currentMonth.getTime() >= lowerBound.getTime()
    ) {
      const monthWindow =
        this.genericTimelineService.createTimelineMonthWindow(currentMonth);
      const month = this.genericTimelineService.buildTimelineMonth(
        datasets,
        monthWindow,
      );
      response.months.push(month);

      currentMonth = this.genericTimelineService.addMonths(currentMonth, -1);
    }

    response.hasMore = currentMonth.getTime() >= lowerBound.getTime();
    response.nextBefore = response.hasMore
      ? this.genericTimelineService.formatTimelineCursor(currentMonth)
      : null;

    return response;
  }
  // #endregion

  // #region Change Log
  async getRecordChangeLog(
    entityHandle: string,
    handle: string | number,
    _currentUser: PersonItem,
  ): Promise<ChangeLogResponseDto[]> {
    void _currentUser;

    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      entityHandle,
      handle,
    );
    return this.genericChangeLogService.getRecordChangeLog(
      entityHandle,
      normalizedHandle,
    );
  }
  // #endregion

  // #region Create
  /**
   * Creates a new entry for an entity, applies security, and runs before/after scripts.
   * @param {string} entityHandle Name of the entity
   * @param {object} data Data for the new entity
   * @param {PersonItem} currentUser Current user object
   * @returns {Promise<object>} The created entity
   */
  async create(
    entityHandle: string,
    data: { createdAt?: Date; updatedAt?: Date; [key: string]: any },
    currentUser: PersonItem,
    scriptContext: ScriptServerContext = {},
  ): Promise<object> {
    const template = this.templateService.getEntityTemplate(entityHandle);
    data = normalizeSaplingPhonePayload(template, data);
    const splitPayload = this.genericCustomFieldService.splitPayload(data);
    data = splitPayload.data;
    await this.genericCustomFieldService.assertRequiredFields(
      entityHandle,
      splitPayload.customFields,
    );
    const inlineCollections = this.extractInlineCollectionPayload(
      template,
      data,
    );
    const submittedSnapshot =
      this.genericChangeLogService.captureSubmittedChangeLogPayload(
        template,
        data,
      );

    this.genericPermissionService.checkTopLevelPermission(
      entityHandle,
      data,
      currentUser,
      'allowInsertStage',
    );

    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    let newData: object;
    data = this.genericPayloadService.prepareCreatePayload(template, data);

    data = await this.genericMutationService.applyBeforeScript(
      ScriptMethods.beforeInsert,
      data,
      entity,
      currentUser,
      scriptContext,
    );

    await this.genericReferenceService.validateReferenceDependencies(
      entityHandle,
      data,
      template,
      currentUser,
    );

    const entityClass = this.genericQueryService.getEntityClass(entityHandle);

    newData = await this.genericMutationService.createAndFlush(
      entityHandle,
      entityClass,
      data,
      template,
    );
    this.invalidateTemplateMetadataAfterMutation(entityHandle);

    if (entity) {
      const overwrittenData =
        await this.genericMutationService.applyAfterScript(
          ScriptMethods.afterInsert,
          newData,
          entity,
          currentUser,
          scriptContext,
        );

      if (overwrittenData !== newData) {
        newData = await this.genericMutationService.assignAndFlush(
          entityHandle,
          newData,
          overwrittenData,
          template,
        );
      }
    }

    await this.syncInlineCollections(
      entityHandle,
      newData,
      inlineCollections,
      currentUser,
    );

    this.scheduleBackgroundTask('changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'create',
        entity,
        currentUser,
        null,
        submittedSnapshot,
      ),
    );

    this.scheduleBackgroundTask('openTaskCountChanges', () =>
      this.genericOpenTaskEventsService.emitCountChangesForHandle(
        entityHandle,
        this.extractEntityHandle(newData),
      ),
    );

    await this.genericCustomFieldService.upsertCustomFieldValues(
      entityHandle,
      this.extractEntityHandle(newData),
      splitPayload.customFields,
    );

    this.scheduleBackgroundTask('emailAutomation', () =>
      this.emailAutomationService.handleAfterInsert(
        entityHandle,
        newData,
        currentUser,
      ),
    );

    const sanitized = this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      newData,
      template,
    );
    return this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      sanitized,
    );
  }

  // #endregion

  // #region Update
  /**
   * Updates an entry by its handle, applies security, and runs before/after scripts.
   * @param {string} entityHandle Name of the entity
   * @param {string | number} handle Handle of the entity
   * @param {object} data Data to update
   * @param {PersonItem} currentUser Current user object
   * @param {string[]} relations Relations to populate
   * @returns {Promise<object>} The updated entity
   */
  async update(
    entityHandle: string,
    handle: string | number,
    data: { createdAt?: Date; updatedAt?: Date; [key: string]: any },
    currentUser: PersonItem,
    relations: string[] = [],
    scriptContext: ScriptServerContext = {},
    concurrencyOptions: GenericUpdateConcurrencyOptions = {},
  ): Promise<object> {
    const updatePayload =
      this.genericUpdateConflictService.extractConcurrencyMetadata(
        data,
        concurrencyOptions,
      );
    data = updatePayload.data;
    const template = this.templateService.getEntityTemplate(entityHandle);
    data = normalizeSaplingPhonePayload(template, data);
    const splitPayload = this.genericCustomFieldService.splitPayload(data);
    data = splitPayload.data;
    const concurrency = updatePayload.concurrency;
    const previousOpenTaskUserHandles =
      await this.genericOpenTaskEventsService.loadUserHandles(
        entityHandle,
        handle,
      );

    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    const inlineCollections = this.extractInlineCollectionPayload(
      template,
      data,
    );
    let submittedSnapshot =
      this.genericChangeLogService.captureSubmittedChangeLogPayload(
        template,
        data,
      );
    const populate = this.genericQueryService.buildPopulate(
      relations,
      template,
    );
    let newData: object;

    const handleFilter = this.genericReferenceService.getHandleFilter(
      entityHandle,
      handle,
    );
    const visibleHandleFilter =
      this.genericPermissionService.applyEntityVisibilityFilter(
        handleFilter,
        currentUser,
        entityHandle,
      );
    const item = await this.em.findOne(entityClass, visibleHandleFilter, {
      populate: populate as any[],
    });

    if (!item) {
      throw new NotFoundException(`global.entityNotFound`);
    }

    const oldSnapshot =
      this.genericChangeLogService.captureEntityChangeLogPayload(
        entityHandle,
        item,
        template,
        submittedSnapshot,
      );

    this.genericPermissionService.checkTopLevelPermission(
      entityHandle,
      { ...item, ...data },
      currentUser,
      'allowUpdateStage',
    );

    const conflict = this.genericUpdateConflictService.evaluate(
      entityHandle,
      item,
      template,
      submittedSnapshot,
      concurrency,
    );

    if (
      conflict.stale &&
      conflict.fields.length > 0 &&
      concurrency.resolution !== 'overwrite'
    ) {
      if (
        concurrency.resolution === 'merge' &&
        conflict.conflictingProperties.length === 0
      ) {
        data = this.genericUpdateConflictService.buildAutomaticMergePayload(
          data,
          conflict,
        );
        submittedSnapshot =
          this.genericChangeLogService.captureSubmittedChangeLogPayload(
            template,
            data,
          );
      } else {
        throw new ConflictException(
          await this.genericUpdateConflictService.buildExceptionBody(
            entityHandle,
            handle,
            conflict,
          ),
        );
      }
    }

    data = this.genericPayloadService.prepareUpdatePayload(template, data);

    data = await this.genericMutationService.applyBeforeScript(
      ScriptMethods.beforeUpdate,
      data,
      entity,
      currentUser,
      { ...scriptContext, currentItems: [item] },
    );

    await this.genericReferenceService.validateReferenceDependencies(
      entityHandle,
      this.genericPayloadService.buildDependencyValidationPayload(item, data),
      template,
      currentUser,
    );

    newData = await this.genericMutationService.assignAndFlush(
      entityHandle,
      item,
      data,
      template,
    );
    this.invalidateTemplateMetadataAfterMutation(entityHandle);

    if (entity && newData) {
      const overwrittenData =
        await this.genericMutationService.applyAfterScript(
          ScriptMethods.afterUpdate,
          newData,
          entity,
          currentUser,
          scriptContext,
        );

      if (overwrittenData !== newData) {
        newData = await this.genericMutationService.assignAndFlush(
          entityHandle,
          item,
          overwrittenData,
          template,
        );
      }
    }

    await this.syncInlineCollections(
      entityHandle,
      newData,
      inlineCollections,
      currentUser,
    );

    this.scheduleBackgroundTask('changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'update',
        entity,
        currentUser,
        oldSnapshot,
        submittedSnapshot,
      ),
    );

    this.scheduleBackgroundTask('openTaskCountChanges', () =>
      this.genericOpenTaskEventsService.emitCountChangesForHandle(
        entityHandle,
        handle,
        previousOpenTaskUserHandles,
      ),
    );

    await this.genericCustomFieldService.upsertCustomFieldValues(
      entityHandle,
      handle,
      splitPayload.customFields,
    );

    const newSnapshot =
      this.genericChangeLogService.captureEntityChangeLogPayload(
        entityHandle,
        newData,
        template,
        submittedSnapshot,
      );

    this.scheduleBackgroundTask('emailAutomation', () =>
      this.emailAutomationService.handleAfterUpdate(
        entityHandle,
        handle,
        oldSnapshot,
        newSnapshot,
        currentUser,
      ),
    );

    const sanitized = this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      newData,
      template,
    );
    return this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      sanitized,
    );
  }

  // #endregion

  // #region Delete
  /**
   * Deletes an entry by its handle, applies security, and runs before/after scripts.
   * @param {string} entityHandle Name of the entity
   * @param {string | number} handle Handle of the entity
   * @param {PersonItem} currentUser Current user object
   * @returns {Promise<void>} No return value
   */
  async delete(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext = {},
  ): Promise<void> {
    const previousOpenTaskUserHandles =
      await this.genericOpenTaskEventsService.loadUserHandles(
        entityHandle,
        handle,
      );

    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const template = this.templateService.getEntityTemplate(entityHandle);
    const handleFilter = this.genericReferenceService.getHandleFilter(
      entityHandle,
      handle,
    );
    const visibleHandleFilter =
      this.genericPermissionService.applyEntityVisibilityFilter(
        handleFilter,
        currentUser,
        entityHandle,
      );
    let item = await this.em.findOne(entityClass, visibleHandleFilter);
    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });

    if (!item) {
      throw new NotFoundException(`global.entityNotFound`);
    }

    const oldSnapshot =
      this.genericChangeLogService.captureEntityChangeLogPayload(
        entityHandle,
        item,
        template,
      );

    this.genericPermissionService.checkTopLevelPermission(
      entityHandle,
      item,
      currentUser,
      'allowDeleteStage',
    );

    item = await this.genericMutationService.applyBeforeScript(
      ScriptMethods.beforeDelete,
      item,
      entity,
      currentUser,
      scriptContext,
    );

    const affectedRows = await this.genericMutationService.deleteAndFlush(
      entityHandle,
      entityClass,
      handleFilter,
    );

    if (affectedRows === 0) {
      throw new NotFoundException(`global.entityNotFound`);
    }
    this.invalidateTemplateMetadataAfterMutation(entityHandle);

    if (entity) {
      await this.genericMutationService.applyAfterScript(
        ScriptMethods.afterDelete,
        item,
        entity,
        currentUser,
        scriptContext,
      );
    }

    this.scheduleBackgroundTask('changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'delete',
        entity,
        currentUser,
        oldSnapshot,
        null,
      ),
    );

    this.scheduleBackgroundTask('openTaskCountChanges', () =>
      this.genericOpenTaskEventsService.notifyUsers(
        previousOpenTaskUserHandles,
      ),
    );
  }

  // #endregion

  // #region Reference
  /**
   * Adds references to an n:m relation without overwriting the entire relation.
   * @param {string} entityHandle Name of the entity
   * @param {string} referenceName Name of the reference relation
   * @param {string | number} entityHandleValue Handle of the entity
   * @param {string | number} referenceHandleValue Handle of the reference
   * @param {PersonItem} currentUser Current user object
   * @returns {Promise<object>} Result of reference creation
   */
  async createReference(
    entityHandle: string,
    referenceName: string,
    entityHandleValue: string | number,
    referenceHandleValue: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext = {},
  ): Promise<object> {
    const previousOpenTaskUserHandles =
      await this.genericOpenTaskEventsService.loadReferenceUserHandles(
        entityHandle,
        referenceName,
        entityHandleValue,
      );

    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    const mutation = await this.genericRelationService.addReferenceAndFlush(
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
    );
    let newData = mutation.item;

    if (entity) {
      const overwrittenData =
        await this.genericMutationService.applyAfterScript(
          ScriptMethods.addReference,
          newData,
          entity,
          currentUser,
          {
            ...scriptContext,
            referenceName,
            referenceItems: [mutation.referenceItem],
          },
        );

      if (overwrittenData !== newData) {
        newData = (await this.genericMutationService.assignAndFlush(
          entityHandle,
          newData,
          overwrittenData,
          mutation.template,
        )) as Record<string, unknown>;
      }
    }

    const ownerUpdate = await this.triggerOwningRelationAfterUpdate(
      entityHandle,
      entity,
      mutation,
      currentUser,
      scriptContext,
    );
    if (ownerUpdate?.entityHandle === entityHandle) {
      newData = ownerUpdate.item;
    }

    await this.genericOpenTaskEventsService.emitReferenceCountChanges(
      entityHandle,
      referenceName,
      entityHandleValue,
      previousOpenTaskUserHandles,
    );

    return this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      newData,
      mutation.template,
    );
  }

  /**
   * Removes references from an n:m relation without overwriting the entire relation.
   * @param {string} entityHandle Name of the entity
   * @param {string} referenceName Name of the reference relation
   * @param {string | number} entityHandleValue Handle of the entity
   * @param {string | number} referenceHandleValue Handle of the reference
   * @param {PersonItem} currentUser Current user object
   * @returns {Promise<object>} Result of reference deletion
   */
  async deleteReference(
    entityHandle: string,
    referenceName: string,
    entityHandleValue: string | number,
    referenceHandleValue: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext = {},
  ): Promise<object> {
    const previousOpenTaskUserHandles =
      await this.genericOpenTaskEventsService.loadReferenceUserHandles(
        entityHandle,
        referenceName,
        entityHandleValue,
      );

    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    const mutation = await this.genericRelationService.deleteReferenceAndFlush(
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
    );
    let newData = mutation.item;

    if (entity) {
      const overwrittenData =
        await this.genericMutationService.applyAfterScript(
          ScriptMethods.deleteReference,
          newData,
          entity,
          currentUser,
          {
            ...scriptContext,
            referenceName,
            referenceItems: [mutation.referenceItem],
          },
        );

      if (overwrittenData !== newData) {
        newData = (await this.genericMutationService.assignAndFlush(
          entityHandle,
          newData,
          overwrittenData,
          mutation.template,
        )) as Record<string, unknown>;
      }
    }

    const ownerUpdate = await this.triggerOwningRelationAfterUpdate(
      entityHandle,
      entity,
      mutation,
      currentUser,
      scriptContext,
    );
    if (ownerUpdate?.entityHandle === entityHandle) {
      newData = ownerUpdate.item;
    }

    await this.genericOpenTaskEventsService.emitReferenceCountChanges(
      entityHandle,
      referenceName,
      entityHandleValue,
      previousOpenTaskUserHandles,
    );

    return this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      newData,
      mutation.template,
    );
  }
  // #endregion

  private async triggerOwningRelationAfterUpdate(
    entityHandle: string,
    entity: EntityItem | null,
    mutation: RelationMutationContext,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<{ entityHandle: string; item: Record<string, unknown> } | null> {
    const ownerContext = await this.resolveOwningRelationUpdateContext(
      entityHandle,
      entity,
      mutation,
    );
    if (!ownerContext?.entity) {
      return null;
    }

    // Touch the owning record so relation-only changes also advance updatedAt.
    ownerContext.item.updatedAt = new Date();
    await this.em.flush();

    const overwrittenData = await this.genericMutationService.applyAfterScript(
      ScriptMethods.afterUpdate,
      ownerContext.item,
      ownerContext.entity,
      currentUser,
      {
        ...scriptContext,
        referenceName: ownerContext.referenceName,
        referenceItems: ownerContext.referenceItems,
        currentItems: [ownerContext.item],
      },
    );

    let persistedItem = ownerContext.item;
    if (overwrittenData !== ownerContext.item) {
      persistedItem = (await this.genericMutationService.assignAndFlush(
        ownerContext.entityHandle,
        ownerContext.item,
        overwrittenData,
        ownerContext.template,
      )) as Record<string, unknown>;
    }

    return {
      entityHandle: ownerContext.entityHandle,
      item: persistedItem,
    };
  }

  private async resolveOwningRelationUpdateContext(
    entityHandle: string,
    entity: EntityItem | null,
    mutation: RelationMutationContext,
  ): Promise<{
    entity: EntityItem | null;
    entityHandle: string;
    item: Record<string, unknown>;
    referenceItems: object[];
    referenceName: string;
    template: EntityTemplateDto[];
  } | null> {
    const field = mutation.field;

    if (!field.isReference) {
      return null;
    }

    if (field.kind === '1:m' || field.kind === 'm:n') {
      return {
        entity,
        entityHandle,
        item: mutation.item,
        referenceItems: [mutation.referenceItem],
        referenceName: field.name,
        template: mutation.template,
      };
    }

    if (field.kind !== 'n:m') {
      return null;
    }

    const ownerReferenceName = field.mappedBy ?? field.inversedBy ?? null;
    if (!ownerReferenceName) {
      return null;
    }

    return {
      entity: await this.em.findOne(EntityItem, {
        handle: mutation.referenceEntityHandle,
      }),
      entityHandle: mutation.referenceEntityHandle,
      item: mutation.referenceItem as Record<string, unknown>,
      referenceItems: [mutation.item],
      referenceName: ownerReferenceName,
      template: this.templateService.getEntityTemplate(
        mutation.referenceEntityHandle,
      ),
    };
  }

  private extractInlineCollectionPayload(
    template: EntityTemplateDto[],
    data: Record<string, unknown>,
  ): InlineCollectionMutation[] {
    return template
      .filter((field) => field.inlineCollection)
      .map((field) => {
        if (!Object.prototype.hasOwnProperty.call(data, field.name)) {
          return null;
        }

        const value = data[field.name];
        delete data[field.name];

        if (!Array.isArray(value)) {
          throw new BadRequestException('global.invalidPayload');
        }

        return {
          field,
          items: value.filter(this.isPlainRecord),
        } satisfies InlineCollectionMutation;
      })
      .filter(
        (mutation): mutation is InlineCollectionMutation => mutation !== null,
      );
  }

  private async syncInlineCollections(
    entityHandle: string,
    owner: object,
    mutations: InlineCollectionMutation[],
    currentUser: PersonItem,
  ): Promise<void> {
    if (mutations.length === 0) {
      return;
    }

    const ownerHandle = this.extractEntityHandle(owner);
    if (ownerHandle == null) {
      throw new BadRequestException('global.invalidPayload');
    }

    for (const mutation of mutations) {
      await this.syncInlineCollection(
        entityHandle,
        ownerHandle,
        mutation,
        currentUser,
      );
    }

    await this.em.flush();
  }

  private async syncInlineCollection(
    entityHandle: string,
    ownerHandle: string | number,
    mutation: InlineCollectionMutation,
    currentUser: PersonItem,
  ): Promise<void> {
    const field = mutation.field;
    const referenceEntityHandle = field.referenceName;
    const mappedBy = field.mappedBy;

    if (!referenceEntityHandle || !mappedBy || field.kind !== '1:m') {
      throw new BadRequestException(
        `Inline collection ${entityHandle}.${field.name} must be a 1:m relation with mappedBy metadata.`,
      );
    }

    const referenceClass = this.genericQueryService.getEntityClass(
      referenceEntityHandle,
    );
    const referenceTemplate = this.templateService.getEntityTemplate(
      referenceEntityHandle,
    );
    const existingItems = await this.em.find(referenceClass, {
      [mappedBy]: ownerHandle,
    } as never);
    const existingByHandle = new Map(
      existingItems
        .map((item) => [this.extractEntityHandle(item), item] as const)
        .filter(([handle]) => handle != null)
        .map(([handle, item]) => [String(handle), item] as const),
    );
    const touchedHandles = new Set<string>();

    mutation.items.forEach((item, index) => {
      const handle = this.extractEntityHandle(item);
      const normalizedHandle =
        handle == null
          ? null
          : this.genericReferenceService.normalizeHandleValue(
              referenceEntityHandle,
              handle,
            );
      const existing =
        normalizedHandle == null
          ? null
          : existingByHandle.get(String(normalizedHandle));
      const payload = this.buildInlineCollectionItemPayload(
        referenceTemplate,
        mappedBy,
        ownerHandle,
        item,
        index,
      );

      if (existing) {
        touchedHandles.add(String(normalizedHandle));
        this.genericPermissionService.checkTopLevelPermission(
          referenceEntityHandle,
          { ...(existing as Record<string, unknown>), ...payload },
          currentUser,
          'allowUpdateStage',
        );
        this.em.assign(
          existing,
          this.genericPayloadService.prepareUpdatePayload(
            referenceTemplate,
            payload,
          ) as never,
        );
        return;
      }

      this.genericPermissionService.checkTopLevelPermission(
        referenceEntityHandle,
        payload,
        currentUser,
        'allowInsertStage',
      );
      this.em.create(
        referenceClass,
        this.genericPayloadService.prepareCreatePayload(
          referenceTemplate,
          payload,
        ) as never,
      );
    });

    existingByHandle.forEach((item, handle) => {
      if (touchedHandles.has(handle)) {
        return;
      }

      this.genericPermissionService.checkTopLevelPermission(
        referenceEntityHandle,
        item,
        currentUser,
        'allowDeleteStage',
      );
      this.em.remove(item);
    });
  }

  private buildInlineCollectionItemPayload(
    referenceTemplate: EntityTemplateDto[],
    mappedBy: string,
    ownerHandle: string | number,
    item: Record<string, unknown>,
    index: number,
  ): Record<string, unknown> {
    const payload = { ...item, [mappedBy]: ownerHandle };
    delete payload.handle;

    if (
      referenceTemplate.some((field) => field.name === 'sortOrder') &&
      payload.sortOrder == null
    ) {
      payload.sortOrder = index;
    }

    return payload;
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractEntityHandle(item: object): string | number | null {
    const handle = (item as { handle?: unknown }).handle;

    if (typeof handle === 'string' || typeof handle === 'number') {
      return handle;
    }

    return null;
  }

  private invalidateTemplateMetadataAfterMutation(entityHandle: string): void {
    if (
      entityHandle === 'customFieldDefinition' ||
      entityHandle === 'customFieldType'
    ) {
      this.genericCustomFieldService.invalidateTemplateCache();
    }
  }

  private scheduleBackgroundTask(
    label: string,
    operation: () => Promise<void>,
  ): void {
    setImmediate(() => {
      void operation().catch((error) => {
        global.log?.error?.(`${label}:`, error);
      });
    });
  }

  private removeCustomFieldOrderBy(orderBy: object): object {
    if (!orderBy || typeof orderBy !== 'object' || Array.isArray(orderBy)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(orderBy as Record<string, unknown>).filter(
        ([key]) => !key.startsWith('customFields.'),
      ),
    );
  }

  private async findTimelineRecord(
    entityHandle: string,
    where: object,
    template: EntityTemplateDto[],
    currentUser: PersonItem,
  ): Promise<Record<string, unknown> | null> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const populate = this.genericQueryService.buildPopulate(['m:1'], template);
    const readResult = await this.genericReadService.findOne(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      {
        populate: populate as any[],
      },
    );
    const record = readResult.item;

    if (!record) {
      return null;
    }

    return this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      record,
      template,
    );
  }

  private async loadTimelineDescriptorDatasets(
    descriptors: TimelineRelationDescriptor[],
    mainHandle: string | number,
    currentUser: PersonItem,
    cursorMonth: Date,
  ): Promise<TimelineDescriptorDataset[]> {
    const cursorWindow =
      this.genericTimelineService.createTimelineMonthWindow(cursorMonth);

    return Promise.all(
      descriptors.map(async (descriptor) => {
        const relationFilter =
          this.genericTimelineService.buildTimelineReverseFilter(
            descriptor.relationFields,
            mainHandle,
          );
        const records = await this.findTimelineRecords(
          descriptor.entityHandle,
          this.genericTimelineService.combineWhere(
            relationFilter,
            this.genericTimelineService.buildTimelineRecordUpperBoundFilter(
              descriptor.dateFields,
              cursorWindow.end,
            ),
          ),
          descriptor.template,
          currentUser,
        );

        return {
          descriptor,
          relationFilter,
          records,
        };
      }),
    );
  }

  private async findTimelineRecords(
    entityHandle: string,
    where: object,
    template: EntityTemplateDto[],
    currentUser: PersonItem,
  ): Promise<Record<string, unknown>[]> {
    const entityClass =
      this.genericQueryService.getEntityClass<TimelineRecordResult>(
        entityHandle,
      );
    const populate = this.genericQueryService.buildPopulate(['m:1'], template);
    const readResult = await this.genericReadService.find(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      {
        populate,
        orderBy: { updatedAt: 'DESC', createdAt: 'DESC' },
      },
    );
    const records = readResult.items as TimelineRecordResult[];

    return this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      records,
      template,
    );
  }

  // #endregion
}
