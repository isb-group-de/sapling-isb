import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TemplateService } from '../template/template.service';
import { PersonItem } from '../../entity/PersonItem';
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
import { GenericTimelineService } from './generic-timeline.service';
import { GenericTimelineQueryService } from './generic-timeline-query.service';
import {
  GenericListQueryService,
  type GenericListResult,
} from './generic-list-query.service';
import { GenericInlineCollectionService } from './generic-inline-collection.service';
import { GenericRelationMutationService } from './generic-relation-mutation.service';
import { GenericEntityMutationService } from './generic-entity-mutation.service';
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
import type {
  GenericImportResponse,
  GenericImportRowResult,
} from './generic-import.util';
import { FieldPermissionService } from '../current/field-permission.service';
import { GenericBulkMutationService } from './generic-bulk-mutation.service';
import type {
  GenericBulkUpdateDto,
  GenericBulkUpdateResponseDto,
} from './dto/bulk-update.dto';
export type { GenericImportResponse } from './generic-import.util';
export type { GenericUpdateConcurrencyOptions } from './generic-update-conflict.service';

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
    private readonly genericTimelineQueryService: GenericTimelineQueryService = new GenericTimelineQueryService(
      templateService,
      genericQueryService,
      genericReadService,
      genericReferenceService,
      genericSanitizerService,
      genericTimelineService,
    ),
    private readonly genericListQueryService: GenericListQueryService = new GenericListQueryService(
      templateService,
      genericQueryService,
      genericReadService,
      genericSanitizerService,
      genericCustomFieldService,
    ),
    private readonly genericInlineCollectionService: GenericInlineCollectionService = new GenericInlineCollectionService(
      em,
      templateService,
      genericQueryService,
      genericReferenceService,
      genericPermissionService,
      genericPayloadService,
    ),
    private readonly genericRelationMutationService: GenericRelationMutationService = new GenericRelationMutationService(
      em,
      templateService,
      genericRelationService,
      genericMutationService,
      genericOpenTaskEventsService,
      genericSanitizerService,
    ),
    private readonly genericEntityMutationService: GenericEntityMutationService = new GenericEntityMutationService(
      em,
      templateService,
      genericQueryService,
      genericMutationService,
      genericPayloadService,
      genericPermissionService,
      genericReferenceService,
      genericSanitizerService,
      genericOpenTaskEventsService,
      genericChangeLogService,
      genericUpdateConflictService,
      emailAutomationService,
      genericCustomFieldService,
      genericInlineCollectionService,
    ),
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      assertPayloadAccess: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
    private readonly genericBulkMutationService: GenericBulkMutationService = new GenericBulkMutationService(
      em,
      genericEntityMutationService,
    ),
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
  ): Promise<GenericListResult> {
    return this.genericListQueryService.findAndCount(
      entityHandle,
      where,
      page,
      limit,
      orderBy,
      currentUser,
      relations,
      fields,
    );
  }

  async findWithoutCount(
    entityHandle: string,
    where: object,
    limit: number,
    orderBy: object,
    currentUser: PersonItem,
    relations: string[] = [],
    fields: string[] = [],
  ): Promise<object[]> {
    return this.genericListQueryService.find(
      entityHandle,
      where,
      limit,
      orderBy,
      currentUser,
      relations,
      fields,
    );
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
    return this.genericListQueryService.downloadJSON(
      entityHandle,
      where,
      orderBy,
      currentUser,
      relations,
    );
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
        await this.fieldPermissions.assertPayloadAccess(
          currentUser,
          entityHandle,
          row,
          handle == null ? 'insert' : 'update',
          undefined,
          template,
        );
        const payload = normalizeImportRow(template, row);
        handle = extractImportHandle(payload);
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
    return this.genericTimelineQueryService.getRecordTimeline(
      entityHandle,
      handle,
      currentUser,
      before,
      months,
    );
  }
  // #endregion

  // #region Change Log
  async getRecordChangeLog(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
  ): Promise<ChangeLogResponseDto[]> {
    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      entityHandle,
      handle,
    );
    return this.genericChangeLogService.getRecordChangeLog(
      entityHandle,
      normalizedHandle,
      currentUser,
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
    return this.genericEntityMutationService.create(
      entityHandle,
      data,
      currentUser,
      scriptContext,
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
    return this.genericEntityMutationService.update(
      entityHandle,
      handle,
      data,
      currentUser,
      relations,
      scriptContext,
      concurrencyOptions,
    );
  }

  async bulkUpdate(
    entityHandle: string,
    request: GenericBulkUpdateDto,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext = {},
  ): Promise<GenericBulkUpdateResponseDto> {
    return this.genericBulkMutationService.updateMany(
      entityHandle,
      request,
      currentUser,
      scriptContext,
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
    return this.genericEntityMutationService.delete(
      entityHandle,
      handle,
      currentUser,
      scriptContext,
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
    return this.genericRelationMutationService.createReference(
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
      scriptContext,
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
    return this.genericRelationMutationService.deleteReference(
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
      scriptContext,
    );
  }
  // #endregion

  private extractEntityHandle(item: object): string | number | null {
    const handle = (item as { handle?: unknown }).handle;

    if (typeof handle === 'string' || typeof handle === 'number') {
      return handle;
    }

    return null;
  }

  // #endregion
}
