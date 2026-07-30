import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import type {
  ScriptPostCommitTask,
  ScriptServerContext,
} from '../../script/core/script.interface';
import { ScriptMethods } from '../script/script.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
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
import { FieldPermissionService } from '../current/field-permission.service';
import { normalizeEventBufferMutationPayload } from '../../calendar/event-buffer.utils';
import { SecurityPrincipalCacheService } from '../current/security-principal-cache.service';
import { GlobalSearchIndexService } from './global-search-index.service';

type GenericMutationPayload = {
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
};

export type GenericPostCommitTask = ScriptPostCommitTask;

export type GenericMutationLifecycleOptions = {
  postCommitTasks?: GenericPostCommitTask[];
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
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      assertPayloadAccess: () => Promise.resolve(),
      renameFieldOverrides: () => Promise.resolve(),
      deleteFieldOverrides: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
    @Optional()
    private readonly securityPrincipalCache?: SecurityPrincipalCacheService,
    @Optional()
    private readonly globalSearchIndex?: GlobalSearchIndexService,
  ) {}

  async create(
    entityHandle: string,
    data: GenericMutationPayload,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    lifecycleOptions: GenericMutationLifecycleOptions = {},
  ): Promise<object> {
    data = normalizeEventBufferMutationPayload(
      entityHandle,
      this.genericPayloadService.sanitizeClientMutationPayload(data),
    );
    const template = this.templateService.getEntityTemplate(entityHandle);
    const permissionTemplate =
      await this.fieldPermissions.getTemplates(entityHandle);
    data = normalizeSaplingPhonePayload(template, data);
    await this.fieldPermissions.assertPayloadAccess(
      currentUser,
      entityHandle,
      data,
      'insert',
      data,
      permissionTemplate,
    );
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
    this.queueBackgroundTask(lifecycleOptions, 'changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'create',
        entity,
        currentUser,
        null,
        submittedSnapshot,
      ),
    );
    this.queueBackgroundTask(lifecycleOptions, 'openTaskCountChanges', () =>
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
    this.invalidateSecurityPrincipalAfterMutation(entityHandle, newData);
    this.queueSearchIndexUpsert(lifecycleOptions, entityHandle, newData);
    if (!scriptContext.suppressNotificationSubscriptions) {
      this.queueBackgroundTask(lifecycleOptions, 'emailAutomation', () =>
        this.emailAutomationService.handleAfterInsert(
          entityHandle,
          newData,
          currentUser,
        ),
      );
    }

    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      newData,
    );
    return this.genericSanitizerService.projectEntityResult(
      entityHandle,
      hydrated,
      currentUser,
      permissionTemplate,
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
    lifecycleOptions: GenericMutationLifecycleOptions = {},
  ): Promise<object> {
    data = normalizeEventBufferMutationPayload(
      entityHandle,
      this.genericPayloadService.sanitizeClientMutationPayload(data),
    );
    const updatePayload =
      this.genericUpdateConflictService.extractConcurrencyMetadata(
        data,
        concurrencyOptions,
      );
    data = updatePayload.data;
    const template = this.templateService.getEntityTemplate(entityHandle);
    data = this.removeMatchingHandleEcho(template, data, handle);
    const submittedPermissionPayload = { ...data };
    const permissionTemplate =
      await this.fieldPermissions.getTemplates(entityHandle);
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

    const customFieldOverrideRename = this.getCustomFieldOverrideChange(
      entityHandle,
      item,
      submittedPermissionPayload.fieldKey,
    );

    await this.fieldPermissions.assertPayloadAccess(
      currentUser,
      entityHandle,
      submittedPermissionPayload,
      'update',
      { ...(item as Record<string, unknown>), ...submittedPermissionPayload },
      permissionTemplate,
    );

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
    this.queueBackgroundTask(lifecycleOptions, 'changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'update',
        entity,
        currentUser,
        oldSnapshot,
        submittedSnapshot,
      ),
    );
    this.queueBackgroundTask(lifecycleOptions, 'openTaskCountChanges', () =>
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
    if (!scriptContext.suppressNotificationSubscriptions) {
      this.queueBackgroundTask(lifecycleOptions, 'emailAutomation', () =>
        this.emailAutomationService.handleAfterUpdate(
          entityHandle,
          handle,
          oldSnapshot,
          newSnapshot,
          currentUser,
        ),
      );
    }

    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      newData,
    );
    if (customFieldOverrideRename) {
      await this.fieldPermissions.renameFieldOverrides(
        customFieldOverrideRename.entityHandle,
        customFieldOverrideRename.oldFieldName,
        customFieldOverrideRename.newFieldName,
      );
    }
    this.invalidateSecurityPrincipalAfterMutation(entityHandle, newData);
    this.queueSearchIndexUpsert(lifecycleOptions, entityHandle, newData);
    return this.genericSanitizerService.projectEntityResult(
      entityHandle,
      hydrated,
      currentUser,
      permissionTemplate,
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

    const customFieldOverrideDelete = this.getCustomFieldOverrideChange(
      entityHandle,
      item,
    );

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
    if (customFieldOverrideDelete) {
      await this.fieldPermissions.deleteFieldOverrides(
        customFieldOverrideDelete.entityHandle,
        customFieldOverrideDelete.oldFieldName,
      );
    }
    this.invalidateSecurityPrincipalAfterMutation(entityHandle, item);
    this.scheduleSearchIndexDelete(entityHandle, item);
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

  private getCustomFieldOverrideChange(
    entityHandle: string,
    item: Record<string, unknown>,
    nextFieldKey?: unknown,
  ): {
    entityHandle: string;
    oldFieldName: string;
    newFieldName: string;
  } | null {
    if (entityHandle !== 'customFieldDefinition') return null;
    const targetEntity = item.entity;
    const targetEntityHandle =
      typeof targetEntity === 'string'
        ? targetEntity
        : targetEntity && typeof targetEntity === 'object'
          ? (targetEntity as { handle?: unknown }).handle
          : null;
    const oldFieldKey = item.fieldKey;
    if (
      typeof targetEntityHandle !== 'string' ||
      typeof oldFieldKey !== 'string'
    ) {
      return null;
    }
    const normalizedNextFieldKey =
      typeof nextFieldKey === 'string' && nextFieldKey.trim()
        ? nextFieldKey.trim()
        : oldFieldKey;
    return {
      entityHandle: targetEntityHandle,
      oldFieldName: `customFields.${oldFieldKey}`,
      newFieldName: `customFields.${normalizedNextFieldKey}`,
    };
  }

  /**
   * Full-record clients commonly echo the primary handle in PATCH payloads.
   * When it identifies the same record as the request parameter, it is not an
   * attempted field change and must not be checked or assigned as one.
   */
  private removeMatchingHandleEcho(
    template: EntityTemplateDto[],
    data: GenericMutationPayload,
    targetHandle: string | number,
  ): GenericMutationPayload {
    const handleField = template.find(
      (field) => field.name === 'handle' && field.isPrimaryKey === true,
    );
    if (
      !handleField ||
      !Object.prototype.hasOwnProperty.call(data, 'handle') ||
      data.handle == null ||
      String(data.handle) !== String(targetHandle)
    ) {
      return data;
    }

    const nextData = { ...data };
    delete nextData.handle;
    return nextData;
  }

  private invalidateTemplateMetadataAfterMutation(entityHandle: string): void {
    if (
      entityHandle === 'customFieldDefinition' ||
      entityHandle === 'customFieldType'
    ) {
      this.genericCustomFieldService.invalidateTemplateCache();
    }
  }

  private invalidateSecurityPrincipalAfterMutation(
    entityHandle: string,
    item: object,
  ): void {
    if (!this.securityPrincipalCache) {
      return;
    }
    if (entityHandle === 'person') {
      const handle = this.extractEntityHandle(item);
      this.securityPrincipalCache.invalidate(
        typeof handle === 'number' ? handle : null,
      );
      return;
    }
    if (
      entityHandle === 'role' ||
      entityHandle === 'permission' ||
      entityHandle === 'fieldPermission'
    ) {
      this.securityPrincipalCache.invalidateAll();
    }
  }

  private scheduleSearchIndexUpsert(entityHandle: string, item: object): void {
    const handle = this.extractEntityHandle(item);
    if (handle == null || !this.globalSearchIndex?.isEnabled()) return;
    this.scheduleBackgroundTask('globalSearchIndex', () =>
      this.globalSearchIndex!.handleUpsert(entityHandle, handle),
    );
  }

  private queueSearchIndexUpsert(
    lifecycleOptions: GenericMutationLifecycleOptions,
    entityHandle: string,
    item: object,
  ): void {
    const handle = this.extractEntityHandle(item);
    if (handle == null || !this.globalSearchIndex?.isEnabled()) return;
    this.queueBackgroundTask(lifecycleOptions, 'globalSearchIndex', () =>
      this.globalSearchIndex!.handleUpsert(entityHandle, handle),
    );
  }

  private scheduleSearchIndexDelete(entityHandle: string, item: object): void {
    const handle = this.extractEntityHandle(item);
    if (handle == null || !this.globalSearchIndex?.isEnabled()) return;
    this.scheduleBackgroundTask('globalSearchIndex', () =>
      this.globalSearchIndex!.handleDelete(entityHandle, handle),
    );
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

  schedulePostCommitTasks(tasks: GenericPostCommitTask[]): void {
    for (const task of tasks) {
      this.scheduleBackgroundTask(task.label, task.operation);
    }
  }

  private queueBackgroundTask(
    lifecycleOptions: GenericMutationLifecycleOptions,
    label: string,
    operation: () => Promise<void>,
  ): void {
    if (lifecycleOptions.postCommitTasks) {
      lifecycleOptions.postCommitTasks.push({ label, operation });
      return;
    }

    this.scheduleBackgroundTask(label, operation);
  }
}
