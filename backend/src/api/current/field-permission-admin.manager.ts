import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Collection, EntityManager, type EntityName } from '@mikro-orm/core';
import type { FieldPermissionItem } from '../../entity/FieldPermissionItem';
import type { PermissionItem } from '../../entity/PermissionItem';
import type { PersonItem } from '../../entity/PersonItem';
import type { RoleItem } from '../../entity/RoleItem';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { SecurityPrincipalCacheService } from './security-principal-cache.service';

export type FieldOverrideInput = {
  fieldName: string;
  allowRead: boolean;
  allowInsert: boolean;
  allowUpdate: boolean;
};

type StructuralFieldAccess = {
  allowRead: boolean;
  allowInsert: boolean;
  allowUpdate: boolean;
};

const FIELD_PERMISSION_ENTITY =
  'FieldPermissionItem' as unknown as EntityName<FieldPermissionItem>;
const PERMISSION_ENTITY =
  'PermissionItem' as unknown as EntityName<PermissionItem>;
const ROLE_ENTITY = 'RoleItem' as unknown as EntityName<RoleItem>;

export class FieldPermissionAdminManager {
  constructor(
    private readonly em: EntityManager,
    private readonly getTemplates: (
      entityHandle: string,
    ) => Promise<EntityTemplateDto[]>,
    private readonly getStructuralAccess: (
      field: EntityTemplateDto,
    ) => StructuralFieldAccess,
    private readonly securityPrincipalCache?: SecurityPrincipalCacheService,
  ) {}

  async getAdminCatalog(roleHandle: number, entityHandle: string) {
    const [role, permission, templates] = await Promise.all([
      this.em.findOne(
        ROLE_ENTITY,
        { handle: roleHandle },
        { populate: ['stage'] },
      ),
      this.em.findOne(
        PERMISSION_ENTITY,
        { role: { handle: roleHandle }, entity: { handle: entityHandle } },
        { populate: ['fieldPermissions', 'entity', 'role', 'role.stage'] },
      ),
      this.getTemplates(entityHandle),
    ]);

    if (!role) {
      throw new NotFoundException('global.notFound');
    }
    if (!permission) {
      throw new NotFoundException('global.permissionNotFound');
    }

    const overrides = new Map(
      this.toArray(permission.fieldPermissions).map((entry) => [
        entry.fieldName,
        entry,
      ]),
    );
    const stage = role.stage?.handle ?? '';
    const knownFieldNames = new Set(templates.map((field) => field.name));

    return {
      roleHandle,
      entityHandle,
      entityPermission: {
        allowRead: permission.allowRead === true,
        allowInsert: permission.allowInsert === true,
        allowUpdate: permission.allowUpdate === true,
      },
      staleOverrides: this.toArray(permission.fieldPermissions)
        .filter((entry) => !knownFieldNames.has(entry.fieldName))
        .map((entry) => ({
          fieldName: entry.fieldName,
          allowRead: entry.allowRead,
          allowInsert: entry.allowInsert,
          allowUpdate: entry.allowUpdate,
        })),
      fields: templates.map((field) => {
        const override = overrides.get(field.name);
        const structural = this.getStructuralAccess(field);
        const inherited = {
          allowRead: permission.allowRead === true,
          allowInsert: permission.allowInsert === true,
          allowUpdate: permission.allowUpdate === true,
        };
        return {
          name: field.name,
          type: field.type,
          formGroup: field.formGroup,
          options: [...(field.options ?? [])],
          isHandle: field.name === 'handle',
          isRequired: field.isRequired,
          isReference: field.isReference,
          customField: field.customField ?? null,
          structural,
          inherited,
          override: override
            ? {
                allowRead: override.allowRead,
                allowInsert: override.allowInsert,
                allowUpdate: override.allowUpdate,
              }
            : null,
          effective: {
            allowRead:
              structural.allowRead &&
              inherited.allowRead &&
              (override?.allowRead ?? true),
            allowInsert:
              structural.allowInsert &&
              inherited.allowInsert &&
              (override?.allowInsert ?? true),
            allowUpdate:
              structural.allowUpdate &&
              inherited.allowUpdate &&
              (override?.allowUpdate ?? true),
            allowReadStage: stage,
            allowInsertStage: stage,
            allowUpdateStage: stage,
          },
        };
      }),
    };
  }

  async saveAdminOverrides(
    actor: PersonItem,
    roleHandle: number,
    entityHandle: string,
    fields: FieldOverrideInput[],
  ) {
    const templates = await this.getTemplates(entityHandle);
    const knownFields = new Set(templates.map((field) => field.name));
    const normalized = new Map<string, FieldOverrideInput>();

    for (const field of fields) {
      const fieldName = field?.fieldName?.trim();
      if (
        !fieldName ||
        !knownFields.has(fieldName) ||
        normalized.has(fieldName)
      ) {
        throw new BadRequestException('global.invalidFieldPermission');
      }
      if (
        typeof field.allowRead !== 'boolean' ||
        typeof field.allowInsert !== 'boolean' ||
        typeof field.allowUpdate !== 'boolean'
      ) {
        throw new BadRequestException('global.invalidFieldPermission');
      }
      normalized.set(fieldName, { ...field, fieldName });
    }

    await this.em.transactional(async (em) => {
      const permission = await em.findOne(
        PERMISSION_ENTITY,
        { role: { handle: roleHandle }, entity: { handle: entityHandle } },
        { populate: ['fieldPermissions'] },
      );
      if (!permission) {
        throw new NotFoundException('global.permissionNotFound');
      }

      const existing = new Map(
        this.toArray(permission.fieldPermissions).map((entry) => [
          entry.fieldName,
          entry,
        ]),
      );

      for (const [fieldName, entry] of existing) {
        if (!normalized.has(fieldName)) {
          em.remove(entry);
        }
      }

      for (const field of normalized.values()) {
        const allInherited =
          field.allowRead && field.allowInsert && field.allowUpdate;
        const current = existing.get(field.fieldName);
        if (allInherited) {
          if (current) em.remove(current);
          continue;
        }
        if (current) {
          current.allowRead = field.allowRead;
          current.allowInsert = field.allowInsert;
          current.allowUpdate = field.allowUpdate;
        } else {
          em.create(FIELD_PERMISSION_ENTITY, {
            permission,
            fieldName: field.fieldName,
            allowRead: field.allowRead,
            allowInsert: field.allowInsert,
            allowUpdate: field.allowUpdate,
          });
        }
      }
    });

    global.log?.info?.('field permissions updated', {
      actorHandle: actor.handle,
      roleHandle,
      entityHandle,
      restrictedFieldCount: [...normalized.values()].filter(
        (field) => !field.allowRead || !field.allowInsert || !field.allowUpdate,
      ).length,
    });
    this.securityPrincipalCache?.invalidateAll();
    return this.getAdminCatalog(roleHandle, entityHandle);
  }

  async renameFieldOverrides(
    entityHandle: string,
    oldFieldName: string,
    newFieldName: string,
  ): Promise<void> {
    if (oldFieldName === newFieldName) return;
    await this.em.transactional(async (em) => {
      const overrides = await em.find(
        FIELD_PERMISSION_ENTITY,
        {
          permission: { entity: { handle: entityHandle } },
          fieldName: { $in: [oldFieldName, newFieldName] },
        },
        { populate: ['permission'] },
      );
      const byPermission = new Map<number, FieldPermissionItem[]>();
      for (const override of overrides) {
        const permissionHandle = override.permission.handle;
        if (permissionHandle == null) continue;
        const entries = byPermission.get(permissionHandle) ?? [];
        entries.push(override);
        byPermission.set(permissionHandle, entries);
      }
      for (const entries of byPermission.values()) {
        const source = entries.find(
          (entry) => entry.fieldName === oldFieldName,
        );
        if (!source) continue;
        const staleTarget = entries.find(
          (entry) => entry.fieldName === newFieldName,
        );
        if (staleTarget?.handle != null) {
          await em.nativeDelete(FIELD_PERMISSION_ENTITY, {
            handle: staleTarget.handle,
          });
        }
        source.fieldName = newFieldName;
      }
    });
    this.securityPrincipalCache?.invalidateAll();
  }

  async deleteFieldOverrides(
    entityHandle: string,
    fieldName: string,
  ): Promise<void> {
    await this.em.nativeDelete(FIELD_PERMISSION_ENTITY, {
      permission: { entity: { handle: entityHandle } },
      fieldName,
    });
    this.securityPrincipalCache?.invalidateAll();
  }

  private toArray<T extends object>(
    value: Collection<T> | T[] | undefined | null,
  ): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : value.getItems(false);
  }
}
