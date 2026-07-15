import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { ScriptMethods } from '../script/script.service';
import { TemplateService } from '../template/template.service';
import { EmailAutomationService } from '../mail/email-automation.service';
import { normalizeSaplingPhonePayload } from '../common/sapling-phone.util';
import { GenericChangeLogService } from './generic-change-log.service';
import { GenericCustomFieldService } from './generic-custom-field.service';
import { GenericInlineCollectionService } from './generic-inline-collection.service';
import { GenericMutationService } from './generic-mutation.service';
import { GenericOpenTaskEventsService } from './generic-open-task-events.service';
import { GenericPayloadService } from './generic-payload.service';
import { GenericPermissionService } from './generic-permission.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReferenceService } from './generic-reference.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import {
  GenericUpdateConflictService,
  type GenericUpdateConcurrencyOptions,
} from './generic-update-conflict.service';

type GenericMutationPayload = {
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
};

/** Executes complete create, update, and delete entity lifecycles. */
@Injectable()
export class GenericEntityMutationService {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericQueryService: GenericQueryService,
    private readonly genericMutationService: GenericMutationService,
    private readonly genericPayloadService: GenericPayloadService,
    private readonly genericPermissionService: GenericPermissionService,
    private readonly genericReferenceService: GenericReferenceService,
    private readonly genericSanitizerService: GenericSanitizerService,
    private readonly genericOpenTaskEventsService: GenericOpenTaskEventsService,
    private readonly genericChangeLogService: GenericChangeLogService,
    private readonly genericUpdateConflictService: GenericUpdateConflictService,
    private readonly emailAutomationService: EmailAutomationService,
    private readonly genericCustomFieldService: GenericCustomFieldService,
    private readonly genericInlineCollectionService: GenericInlineCollectionService,
  ) {}

  async create(
    entityHandle: string,
    data: GenericMutationPayload,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<object> {
    const template = this.templateService.getEntityTemplate(entityHandle);
    data = normalizeSaplingPhonePayload(template, data);
    const splitPayload = this.genericCustomFieldService.splitPayload(data);
    data = splitPayload.data;
    await this.genericCustomFieldService.assertRequiredFields(
      entityHandle,
      splitPayload.customFields,
    );
    const inlineCollections =
      this.genericInlineCollectionService.extractPayload(template, data);
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
    let newData = await this.genericMutationService.createAndFlush(
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

    await this.genericInlineCollectionService.sync(
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

  async update(
    entityHandle: string,
    handle: string | number,
    data: GenericMutationPayload,
    currentUser: PersonItem,
    relations: string[],
    scriptContext: ScriptServerContext,
    concurrencyOptions: GenericUpdateConcurrencyOptions,
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
    const { concurrency } = updatePayload;
    const previousOpenTaskUserHandles =
      await this.genericOpenTaskEventsService.loadUserHandles(
        entityHandle,
        handle,
      );
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    const inlineCollections =
      this.genericInlineCollectionService.extractPayload(template, data);
    let submittedSnapshot =
      this.genericChangeLogService.captureSubmittedChangeLogPayload(
        template,
        data,
      );
    const populate = this.genericQueryService.buildPopulate(
      relations,
      template,
    );
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

    let newData = await this.genericMutationService.assignAndFlush(
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

    await this.genericInlineCollectionService.sync(
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

  async delete(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
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

  private extractEntityHandle(item: object): string | number | null {
    const handle = (item as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
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
}
