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
import { buildChangeLogDetails } from './generic-change-log.util';
import { GenericEntityMutationOperations } from './generic-entity-mutation.operations';
import { AutomationEventService } from '../automation/automation-event.service';

export type GenericMutationPayload = {
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
export class GenericEntityMutationService extends GenericEntityMutationOperations {
  constructor(
    em: EntityManager,
    templateService: TemplateService,
    genericQueryService: GenericQueryService,
    genericMutationService: GenericMutationService,
    genericPayloadService: GenericPayloadService,
    genericPermissionService: GenericPermissionService,
    genericReferenceService: GenericReferenceService,
    genericSanitizerService: GenericSanitizerService,
    genericOpenTaskEventsService: GenericOpenTaskEventsService,
    genericChangeLogService: GenericChangeLogService,
    genericUpdateConflictService: GenericUpdateConflictService,
    emailAutomationService: EmailAutomationService,
    genericCustomFieldService: GenericCustomFieldService,
    genericInlineCollectionService: GenericInlineCollectionService,
    fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(templateService.getEntityTemplate(entityHandle)),
      assertPayloadAccess: () => Promise.resolve(),
      renameFieldOverrides: () => Promise.resolve(),
      deleteFieldOverrides: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
    @Optional()
    securityPrincipalCache?: SecurityPrincipalCacheService,
    @Optional()
    globalSearchIndex?: GlobalSearchIndexService,
    @Optional()
    automationEvents?: AutomationEventService,
  ) {
    super(
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
      fieldPermissions,
      securityPrincipalCache,
      globalSearchIndex,
      automationEvents,
    );
  }

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
        permissionTemplate,
        this.withCustomFields(data, splitPayload.customFields),
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
    const createdChangeLogSnapshot =
      this.genericChangeLogService.withRecordReference(
        submittedSnapshot,
        this.extractEntityHandle(newData),
      );
    this.queueBackgroundTask(lifecycleOptions, 'changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'create',
        entity,
        currentUser,
        null,
        createdChangeLogSnapshot,
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
    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      newData,
    );
    this.invalidateSecurityPrincipalAfterMutation(entityHandle, newData);
    this.queueSearchIndexUpsert(lifecycleOptions, entityHandle, newData);
    if (!scriptContext.suppressNotificationSubscriptions) {
      this.queueBackgroundTask(lifecycleOptions, 'emailAutomation', () =>
        this.emailAutomationService.handleAfterInsert(
          entityHandle,
          hydrated,
          currentUser,
        ),
      );
    }

    const newAutomationSnapshot =
      this.genericChangeLogService.captureEntityChangeLogPayload(
        entityHandle,
        hydrated,
        permissionTemplate,
      );
    await this.automationEvents?.record({
      entityHandle,
      sourceHandle: this.extractEntityHandle(hydrated),
      operation: 'afterInsert',
      actor: currentUser,
      oldSnapshot: null,
      newSnapshot: newAutomationSnapshot,
    });

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
    data = this.removeMatchingHandleEcho(data, handle);
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
        permissionTemplate,
        this.withCustomFields(data, splitPayload.customFields),
      );
    const submittedToOneRelations = permissionTemplate
      .filter(
        (field) =>
          field.isReference &&
          !['1:m', 'm:n', 'n:m'].includes(field.kind ?? '') &&
          submittedSnapshot != null &&
          Object.prototype.hasOwnProperty.call(submittedSnapshot, field.name),
      )
      .map((field) => field.name);
    const populate = this.genericQueryService.buildPopulate(
      [...relations, ...submittedToOneRelations],
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

    await this.genericCustomFieldService.hydrateRecords(entityHandle, item);

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
        permissionTemplate,
        submittedSnapshot,
      );
    const oldAutomationSnapshot =
      this.genericChangeLogService.captureEntityChangeLogPayload(
        entityHandle,
        item,
        permissionTemplate,
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
    const changedFields = buildChangeLogDetails(
      'update',
      oldSnapshot,
      submittedSnapshot,
    ).map((detail) => detail.property);
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
          { ...scriptContext, changedFields },
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
    const updatedRecordReference = this.extractEntityHandle(newData) ?? handle;
    const oldChangeLogSnapshot =
      this.genericChangeLogService.withRecordReference(
        oldSnapshot,
        updatedRecordReference,
      );
    const newChangeLogSnapshot =
      this.genericChangeLogService.withRecordReference(
        submittedSnapshot,
        updatedRecordReference,
      );
    this.queueBackgroundTask(lifecycleOptions, 'changeLog', () =>
      this.genericChangeLogService.safeStoreChangeLog(
        'update',
        entity,
        currentUser,
        oldChangeLogSnapshot,
        newChangeLogSnapshot,
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
    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      newData,
    );
    const newAutomationSnapshot =
      this.genericChangeLogService.captureEntityChangeLogPayload(
        entityHandle,
        hydrated,
        permissionTemplate,
      );
    if (!scriptContext.suppressNotificationSubscriptions) {
      this.queueBackgroundTask(lifecycleOptions, 'emailAutomation', () =>
        this.emailAutomationService.handleAfterUpdate(
          entityHandle,
          handle,
          oldAutomationSnapshot,
          newAutomationSnapshot,
          currentUser,
        ),
      );
    }

    if (customFieldOverrideRename) {
      await this.fieldPermissions.renameFieldOverrides(
        customFieldOverrideRename.entityHandle,
        customFieldOverrideRename.oldFieldName,
        customFieldOverrideRename.newFieldName,
      );
    }
    await this.automationEvents?.record({
      entityHandle,
      sourceHandle: updatedRecordReference,
      operation: 'afterUpdate',
      actor: currentUser,
      oldSnapshot: oldAutomationSnapshot,
      newSnapshot: newAutomationSnapshot,
    });
    this.invalidateSecurityPrincipalAfterMutation(entityHandle, newData);
    this.queueSearchIndexUpsert(lifecycleOptions, entityHandle, newData);
    return this.genericSanitizerService.projectEntityResult(
      entityHandle,
      hydrated,
      currentUser,
      permissionTemplate,
    );
  }
}
