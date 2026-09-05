import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import type { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { ScriptMethods } from '../script/script.service';
import type { TemplateService } from '../template/template.service';
import type { EmailAutomationService } from '../mail/email-automation.service';
import type { GenericChangeLogService } from './generic-change-log.service';
import type { GenericCustomFieldService } from './generic-custom-field.service';
import type { GenericInlineCollectionService } from './generic-inline-collection.service';
import type { GenericMutationService } from './generic-mutation.service';
import type { GenericOpenTaskEventsService } from './generic-open-task-events.service';
import type { GenericPayloadService } from './generic-payload.service';
import type { GenericPermissionService } from './generic-permission.service';
import type { GenericQueryService } from './generic-query.service';
import type { GenericReferenceService } from './generic-reference.service';
import type { GenericSanitizerService } from './generic-sanitizer.service';
import type { GenericUpdateConflictService } from './generic-update-conflict.service';
import type { FieldPermissionService } from '../current/field-permission.service';
import type { SecurityPrincipalCacheService } from '../current/security-principal-cache.service';
import type { GlobalSearchIndexService } from './global-search-index.service';
import type { AutomationEventService } from '../automation/automation-event.service';
import {
  captureStoredDocumentFileDescriptor,
  deleteStoredDocumentFile,
} from '../document/document-storage.util';
import type {
  GenericMutationLifecycleOptions,
  GenericMutationPayload,
  GenericPostCommitTask,
} from './generic-entity-mutation.service';

export class GenericEntityMutationOperations {
  constructor(
    protected readonly em: EntityManager,
    protected readonly templateService: TemplateService,
    protected readonly genericQueryService: GenericQueryService,
    protected readonly genericMutationService: GenericMutationService,
    protected readonly genericPayloadService: GenericPayloadService,
    protected readonly genericPermissionService: GenericPermissionService,
    protected readonly genericReferenceService: GenericReferenceService,
    protected readonly genericSanitizerService: GenericSanitizerService,
    protected readonly genericOpenTaskEventsService: GenericOpenTaskEventsService,
    protected readonly genericChangeLogService: GenericChangeLogService,
    protected readonly genericUpdateConflictService: GenericUpdateConflictService,
    protected readonly emailAutomationService: EmailAutomationService,
    protected readonly genericCustomFieldService: GenericCustomFieldService,
    protected readonly genericInlineCollectionService: GenericInlineCollectionService,
    protected readonly fieldPermissions: FieldPermissionService,
    protected readonly securityPrincipalCache?: SecurityPrincipalCacheService,
    protected readonly globalSearchIndex?: GlobalSearchIndexService,
    protected readonly automationEvents?: AutomationEventService,
  ) {}

  async delete(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    lifecycleOptions: GenericMutationLifecycleOptions = {},
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
    const storedDocumentFile =
      entityHandle === 'document'
        ? captureStoredDocumentFileDescriptor(item)
        : null;

    await lifecycleOptions.assertDeleteIntegrity?.();
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
    this.queueSearchIndexDelete(lifecycleOptions, entityHandle, item);
    this.invalidateTemplateMetadataAfterMutation(entityHandle);
    if (storedDocumentFile) {
      this.queueBackgroundTask(lifecycleOptions, 'documentFileDelete', () =>
        deleteStoredDocumentFile(storedDocumentFile),
      );
    }

    if (entity) {
      await this.genericMutationService.applyAfterScript(
        ScriptMethods.afterDelete,
        item,
        entity,
        currentUser,
        scriptContext,
      );
    }
    this.queueBackgroundTask(lifecycleOptions, 'changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        lifecycleOptions.mergeTargetHandle == null ? 'delete' : 'merge',
        entity,
        lifecycleOptions.effectActor ?? currentUser,
        oldSnapshot,
        lifecycleOptions.mergeTargetHandle == null
          ? null
          : { handle: lifecycleOptions.mergeTargetHandle },
      ),
    );
    this.queueBackgroundTask(lifecycleOptions, 'openTaskCountChanges', () =>
      this.genericOpenTaskEventsService.notifyUsers(
        previousOpenTaskUserHandles,
      ),
    );
    // A merge has a surviving identity. Its final update drives automations;
    // a delete event must not later run deletion rules against that survivor.
    if (lifecycleOptions.mergeTargetHandle == null) {
      await this.automationEvents?.record({
        entityHandle,
        sourceHandle: handle,
        operation: 'afterDelete',
        actor: currentUser,
        oldSnapshot,
        newSnapshot: null,
      });
    }
  }

  protected extractEntityHandle(item: object): string | number | null {
    const handle = (item as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }

  protected withCustomFields(
    data: GenericMutationPayload,
    customFields: Record<string, unknown>,
  ): GenericMutationPayload {
    if (Object.keys(customFields).length === 0) {
      return data;
    }

    return {
      ...data,
      customFields,
    };
  }

  protected getCustomFieldOverrideChange(
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
  protected removeMatchingHandleEcho(
    data: GenericMutationPayload,
    targetHandle: string | number,
  ): GenericMutationPayload {
    if (
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

  protected invalidateTemplateMetadataAfterMutation(
    entityHandle: string,
  ): void {
    if (
      entityHandle === 'customFieldDefinition' ||
      entityHandle === 'customFieldType'
    ) {
      this.genericCustomFieldService.invalidateTemplateCache();
    }
  }

  protected invalidateSecurityPrincipalAfterMutation(
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

  protected scheduleSearchIndexUpsert(
    entityHandle: string,
    item: object,
  ): void {
    const handle = this.extractEntityHandle(item);
    if (handle == null || !this.globalSearchIndex?.isEnabled()) return;
    this.scheduleBackgroundTask('globalSearchIndex', () =>
      this.globalSearchIndex!.handleUpsert(entityHandle, handle),
    );
  }

  protected queueSearchIndexUpsert(
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

  protected queueSearchIndexDelete(
    lifecycleOptions: GenericMutationLifecycleOptions,
    entityHandle: string,
    item: object,
  ): void {
    const handle = this.extractEntityHandle(item);
    if (handle == null || !this.globalSearchIndex?.isEnabled()) return;
    this.queueBackgroundTask(lifecycleOptions, 'globalSearchIndex', () =>
      this.globalSearchIndex!.handleDelete(entityHandle, handle),
    );
  }

  protected scheduleBackgroundTask(
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

  protected queueBackgroundTask(
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
