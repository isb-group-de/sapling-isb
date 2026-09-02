import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { Collection, EntityManager } from '@mikro-orm/core';
import type { PersonItem } from '../../entity/PersonItem';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import { isPublicGenericReadEntity } from '../../auth/public-generic-read-entities';
import {
  FieldPermissionAdminManager,
  type FieldOverrideInput,
} from './field-permission-admin.manager';
import { SecurityPrincipalCacheService } from './security-principal-cache.service';

export type FieldPermissionAction = 'read' | 'insert' | 'update';

export type EffectiveFieldAccess = {
  allowRead: boolean;
  allowInsert: boolean;
  allowUpdate: boolean;
  allowReadStage?: string;
  allowInsertStage?: string;
  allowUpdateStage?: string;
};

type EntityActionKey = 'allowRead' | 'allowInsert' | 'allowUpdate';
type FieldActionKey = EntityActionKey;

@Injectable()
export class FieldPermissionService {
  private readonly adminPermissions: FieldPermissionAdminManager;

  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly customFields: GenericCustomFieldService,
    @Optional()
    private readonly securityPrincipalCache?: SecurityPrincipalCacheService,
  ) {
    this.adminPermissions = new FieldPermissionAdminManager(
      this.em,
      (entityHandle) => this.getTemplates(entityHandle),
      (field) => this.getStructuralAccess(field),
      this.securityPrincipalCache,
    );
  }

  async getTemplates(entityHandle: string): Promise<EntityTemplateDto[]> {
    return this.customFields.appendCustomFieldTemplates(
      entityHandle,
      this.templateService.getEntityTemplate(entityHandle),
    );
  }

  applyTemplateAccess(
    user: PersonItem,
    entityHandle: string,
    templates: EntityTemplateDto[],
  ): EntityTemplateDto[] {
    return templates
      .map((field) => ({
        ...field,
        fieldAccess: this.getFieldAccess(user, entityHandle, field),
      }))
      .filter((field) =>
        Boolean(
          field.fieldAccess?.allowRead ||
          field.fieldAccess?.allowInsert ||
          field.fieldAccess?.allowUpdate,
        ),
      );
  }

  getFieldAccess(
    user: PersonItem,
    entityHandle: string,
    field: EntityTemplateDto,
  ): EffectiveFieldAccess {
    const read = this.resolveAction(user, entityHandle, field, 'read');
    const insert = this.resolveAction(user, entityHandle, field, 'insert');
    const update = this.resolveAction(user, entityHandle, field, 'update');

    return {
      allowRead: read.allowed,
      allowInsert: insert.allowed,
      allowUpdate: update.allowed,
      allowReadStage: read.stage,
      allowInsertStage: insert.stage,
      allowUpdateStage: update.stage,
    };
  }

  canAccessField(
    user: PersonItem,
    entityHandle: string,
    field: EntityTemplateDto,
    action: FieldPermissionAction,
    record?: Record<string, unknown> | null,
    templates: EntityTemplateDto[] = [],
  ): boolean {
    const grants = this.resolveActionGrants(user, entityHandle, field, action);
    return grants.some((grant) =>
      this.recordMatchesStage(user, record, grant.stage, templates),
    );
  }

  async assertPayloadAccess(
    user: PersonItem,
    entityHandle: string,
    payload: Record<string, unknown>,
    action: Exclude<FieldPermissionAction, 'read'>,
    record?: Record<string, unknown> | null,
    templates?: EntityTemplateDto[],
  ): Promise<void> {
    const resolvedTemplates =
      templates ?? (await this.getTemplates(entityHandle));
    const fieldsByName = new Map(
      resolvedTemplates.map((field) => [field.name, field]),
    );
    const submittedFields = this.collectPayloadFields(payload);

    for (const fieldName of submittedFields) {
      const field = fieldsByName.get(fieldName);
      if (!field) {
        continue;
      }

      if (
        !this.canAccessField(
          user,
          entityHandle,
          field,
          action,
          record,
          resolvedTemplates,
        )
      ) {
        this.throwDenied(entityHandle, fieldName, action);
      }
    }
  }

  async assertReadableQuery(
    user: PersonItem | null | undefined,
    entityHandle: string,
    criteria: unknown,
  ): Promise<void> {
    if (isPublicGenericReadEntity(entityHandle)) {
      return;
    }
    if (!user) {
      this.throwDenied(entityHandle, '*', 'read');
    }
    if (!criteria || typeof criteria !== 'object') {
      return;
    }

    const templates = await this.getTemplates(entityHandle);
    const fieldsByName = new Map(templates.map((field) => [field.name, field]));
    await this.assertReadableCriteriaRecord(
      user,
      entityHandle,
      criteria as Record<string, unknown>,
      fieldsByName,
    );
  }

  async assertReadableFields(
    user: PersonItem | null | undefined,
    entityHandle: string,
    fieldNames: string[],
  ): Promise<void> {
    if (isPublicGenericReadEntity(entityHandle)) {
      return;
    }
    if (!user) {
      this.throwDenied(entityHandle, '*', 'read');
    }
    if (fieldNames.length === 0) {
      return;
    }

    const templates = await this.getTemplates(entityHandle);
    const fieldsByName = new Map(templates.map((field) => [field.name, field]));
    for (const rawFieldName of fieldNames) {
      await this.assertReadablePath(
        user,
        entityHandle,
        rawFieldName,
        fieldsByName,
      );
    }
  }

  filterUniversallyReadableFields(
    user: PersonItem | null | undefined,
    entityHandle: string,
    fields: EntityTemplateDto[],
  ): EntityTemplateDto[] {
    if (isPublicGenericReadEntity(entityHandle)) {
      return fields;
    }
    if (!user) {
      this.throwDenied(entityHandle, '*', 'read');
    }

    return fields.filter((field) => {
      try {
        this.assertFieldReadable(user, entityHandle, field);
        return true;
      } catch (error) {
        if (error instanceof ForbiddenException) {
          return false;
        }
        throw error;
      }
    });
  }

  async getAdminCatalog(roleHandle: number, entityHandle: string) {
    return this.adminPermissions.getAdminCatalog(roleHandle, entityHandle);
  }

  async saveAdminOverrides(
    actor: PersonItem,
    roleHandle: number,
    entityHandle: string,
    fields: FieldOverrideInput[],
  ) {
    return this.adminPermissions.saveAdminOverrides(
      actor,
      roleHandle,
      entityHandle,
      fields,
    );
  }

  async renameFieldOverrides(
    entityHandle: string,
    oldFieldName: string,
    newFieldName: string,
  ): Promise<void> {
    return this.adminPermissions.renameFieldOverrides(
      entityHandle,
      oldFieldName,
      newFieldName,
    );
  }

  async deleteFieldOverrides(
    entityHandle: string,
    fieldName: string,
  ): Promise<void> {
    return this.adminPermissions.deleteFieldOverrides(entityHandle, fieldName);
  }

  private resolveAction(
    user: PersonItem,
    entityHandle: string,
    field: EntityTemplateDto,
    action: FieldPermissionAction,
  ): { allowed: boolean; stage?: string } {
    const grants = this.resolveActionGrants(user, entityHandle, field, action);
    return {
      allowed: grants.length > 0,
      stage: this.getEffectiveStage(grants.map((grant) => grant.stage)),
    };
  }

  private resolveActionGrants(
    user: PersonItem,
    entityHandle: string,
    field: EntityTemplateDto,
    action: FieldPermissionAction,
  ): Array<{ stage: string }> {
    const structural = this.getStructuralAccess(field);
    const structuralAllowed = structural[this.toAllowKey(action)];
    if (!structuralAllowed) {
      return [];
    }
    if (action === 'read' && isPublicGenericReadEntity(entityHandle)) {
      return [{ stage: 'global' }];
    }

    const permissionKey = this.toAllowKey(action);
    const grants: Array<{ stage: string }> = [];
    for (const role of this.toArray(user.roles)) {
      const permission = this.toArray(role.permissions).find(
        (entry) => entry.entity?.handle === entityHandle,
      );
      if (!permission || permission[permissionKey] !== true) {
        continue;
      }
      const override = this.toArray(permission.fieldPermissions).find(
        (entry) => entry.fieldName === field.name,
      );
      if (!override || override[permissionKey] === true) {
        grants.push({ stage: role.stage?.handle ?? '' });
      }
    }
    return grants;
  }

  private getStructuralAccess(field: EntityTemplateDto) {
    const isSecurity = field.options?.includes('isSecurity') === true;
    const isReadOnly = field.options?.includes('isReadOnly') === true;
    const isWritableRelation = field.isReference === true;
    const isWritablePersistence = field.isPersistent !== false;
    const writable =
      !isReadOnly &&
      !field.isAutoIncrement &&
      (isWritablePersistence || isWritableRelation);
    return {
      allowRead: !isSecurity,
      allowInsert: writable,
      allowUpdate: writable,
    };
  }

  private recordMatchesStage(
    user: PersonItem,
    record: Record<string, unknown> | null | undefined,
    stage: string | undefined,
    templates: EntityTemplateDto[],
  ): boolean {
    if (!stage || stage === 'global' || !record) {
      return true;
    }
    const fieldOption = stage === 'person' ? 'isPerson' : 'isCompany';
    const expected = stage === 'person' ? user.handle : user.company?.handle;
    const matchingFields = templates.filter((field) =>
      field.options?.includes(fieldOption),
    );
    if (matchingFields.length === 0) {
      return true;
    }
    return matchingFields.some(
      (field) => this.extractHandle(record[field.name]) === expected,
    );
  }

  private async assertReadableCriteriaRecord(
    user: PersonItem,
    entityHandle: string,
    record: Record<string, unknown>,
    fieldsByName: Map<string, EntityTemplateDto>,
  ): Promise<void> {
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith('$')) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              await this.assertReadableCriteriaRecord(
                user,
                entityHandle,
                item as Record<string, unknown>,
                fieldsByName,
              );
            }
          }
        }
        continue;
      }
      if (
        key === 'customFields' &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        for (const customFieldName of Object.keys(value)) {
          await this.assertReadablePath(
            user,
            entityHandle,
            `customFields.${customFieldName}`,
            fieldsByName,
          );
        }
        continue;
      }
      if (key.includes('.')) {
        await this.assertReadablePath(user, entityHandle, key, fieldsByName);
        continue;
      }
      const field = fieldsByName.get(key);
      if (!field) continue;
      this.assertFieldReadable(user, entityHandle, field);
      if (
        field.isReference &&
        field.referenceName &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !Object.keys(value).every((nestedKey) => nestedKey.startsWith('$'))
      ) {
        const nestedTemplates = await this.getTemplates(field.referenceName);
        await this.assertReadableCriteriaRecord(
          user,
          field.referenceName,
          value as Record<string, unknown>,
          new Map(nestedTemplates.map((entry) => [entry.name, entry])),
        );
      }
    }
  }

  private async assertReadablePath(
    user: PersonItem,
    entityHandle: string,
    rawPath: string,
    fieldsByName: Map<string, EntityTemplateDto>,
  ): Promise<void> {
    const direct = fieldsByName.get(rawPath.trim());
    if (direct) {
      this.assertFieldReadable(user, entityHandle, direct);
      return;
    }
    const [head, ...rest] = rawPath.split('.').map((part) => part.trim());
    const field = fieldsByName.get(head);
    if (!field) return;
    this.assertFieldReadable(user, entityHandle, field);
    if (rest.length && field.isReference && field.referenceName) {
      const nestedTemplates = await this.getTemplates(field.referenceName);
      await this.assertReadablePath(
        user,
        field.referenceName,
        rest.join('.'),
        new Map(nestedTemplates.map((entry) => [entry.name, entry])),
      );
    }
  }

  private assertFieldReadable(
    user: PersonItem,
    entityHandle: string,
    field: EntityTemplateDto,
  ) {
    const fieldStages = this.resolveActionGrants(
      user,
      entityHandle,
      field,
      'read',
    ).map((grant) => grant.stage);
    const entityReadStages = this.getEntityReadStages(user, entityHandle);
    const coversEveryEntityStage = entityReadStages.every((entityStage) =>
      fieldStages.some((fieldStage) =>
        this.stageCovers(fieldStage, entityStage),
      ),
    );
    if (fieldStages.length === 0 || !coversEveryEntityStage) {
      this.throwDenied(entityHandle, field.name, 'read');
    }
  }

  private getEntityReadStages(user: PersonItem, entityHandle: string) {
    if (isPublicGenericReadEntity(entityHandle)) {
      return ['global'];
    }
    const stages: string[] = [];
    for (const role of this.toArray(user.roles)) {
      const permission = this.toArray(role.permissions).find(
        (entry) =>
          entry.entity?.handle === entityHandle && entry.allowRead === true,
      );
      if (permission) stages.push(role.stage?.handle ?? '');
    }
    return [...new Set(stages)];
  }

  private stageCovers(fieldStage: string, entityStage: string): boolean {
    return (
      fieldStage === entityStage || fieldStage === '' || fieldStage === 'global'
    );
  }

  private getEffectiveStage(stages: string[]): string | undefined {
    if (stages.length === 0) return undefined;
    if (stages.includes('global') || stages.includes('')) return 'global';
    const uniqueStages = [...new Set(stages)];
    return uniqueStages.length === 1 ? uniqueStages[0] : 'mixed';
  }

  private collectPayloadFields(payload: Record<string, unknown>): string[] {
    const result: string[] = [];
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'customFields' && value && typeof value === 'object') {
        for (const customKey of Object.keys(value)) {
          result.push(`customFields.${customKey}`);
        }
      } else if (!key.startsWith('__')) {
        result.push(key);
      }
    }
    return result;
  }

  private toAllowKey(action: FieldPermissionAction): FieldActionKey {
    switch (action) {
      case 'read':
        return 'allowRead';
      case 'insert':
        return 'allowInsert';
      case 'update':
        return 'allowUpdate';
    }
  }

  private throwDenied(
    entityHandle: string,
    fieldName: string,
    action: FieldPermissionAction,
  ): never {
    throw new ForbiddenException({
      message: 'global.fieldPermissionDenied',
      details: { entityHandle, fieldName, action },
    });
  }

  private extractHandle(value: unknown): unknown {
    if (value && typeof value === 'object') {
      const reference = value as {
        unwrap?: () => unknown;
        getEntity?: () => unknown;
      };
      try {
        if (typeof reference.unwrap === 'function') {
          return this.extractHandle(reference.unwrap());
        }
        if (typeof reference.getEntity === 'function') {
          return this.extractHandle(reference.getEntity());
        }
      } catch {
        return undefined;
      }
    }
    if (value && typeof value === 'object' && 'handle' in value) {
      return (value as { handle?: unknown }).handle;
    }
    return value;
  }

  private toArray<T extends object>(
    value: Collection<T> | T[] | undefined | null,
  ): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : value.getItems(false);
  }
}
