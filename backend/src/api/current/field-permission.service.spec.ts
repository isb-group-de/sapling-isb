import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import type { PersonItem } from '../../entity/PersonItem';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { TemplateService } from '../template/template.service';
import type { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import { FieldPermissionService } from './field-permission.service';

const field = (
  name: string,
  options: string[] = [],
  extra: Partial<EntityTemplateDto> = {},
): EntityTemplateDto =>
  ({
    name,
    options,
    isPersistent: true,
    isAutoIncrement: false,
    isReference: false,
    ...extra,
  }) as EntityTemplateDto;

const permission = (
  entityHandle: string,
  overrides: Array<{
    fieldName: string;
    allowRead: boolean;
    allowInsert: boolean;
    allowUpdate: boolean;
  }> = [],
) => ({
  entity: { handle: entityHandle },
  allowRead: true,
  allowInsert: true,
  allowUpdate: true,
  fieldPermissions: overrides,
});

const user = (
  roles: Array<{
    stage: string;
    permissions: ReturnType<typeof permission>[];
  }>,
): PersonItem =>
  ({
    handle: 7,
    company: { handle: 11 },
    roles: roles.map((role) => ({
      stage: { handle: role.stage },
      permissions: role.permissions,
    })),
  }) as unknown as PersonItem;

describe('FieldPermissionService', () => {
  const templates = [
    field('handle', [], { isPrimaryKey: true }),
    field('title'),
    field('secret'),
    field('creatorCompany', ['isCompany'], {
      isReference: true,
      referenceName: 'company',
    }),
  ];
  const service = new FieldPermissionService(
    {} as EntityManager,
    {
      getEntityTemplate: () => templates,
    } as unknown as TemplateService,
    {
      appendCustomFieldTemplates: async (_entityHandle, base) => base,
    } as unknown as GenericCustomFieldService,
  );

  it('inherits entity permissions when no field override exists', () => {
    const currentUser = user([
      { stage: 'global', permissions: [permission('ticket')] },
    ]);

    expect(
      service.canAccessField(currentUser, 'ticket', field('title'), 'read'),
    ).toBe(true);
  });

  it('uses allow-wins aggregation across multiple roles', () => {
    const deny = permission('ticket', [
      {
        fieldName: 'secret',
        allowRead: false,
        allowInsert: false,
        allowUpdate: false,
      },
    ]);
    const currentUser = user([
      { stage: 'company', permissions: [deny] },
      { stage: 'global', permissions: [permission('ticket')] },
    ]);

    expect(
      service.canAccessField(
        currentUser,
        'ticket',
        field('secret'),
        'read',
        { creatorCompany: { handle: 99 } },
        templates,
      ),
    ).toBe(true);
  });

  it('applies the stage of each granting role to the concrete record', () => {
    const currentUser = user([
      { stage: 'company', permissions: [permission('ticket')] },
    ]);

    expect(
      service.canAccessField(
        currentUser,
        'ticket',
        field('secret'),
        'read',
        { creatorCompany: { handle: 11 } },
        templates,
      ),
    ).toBe(true);
    expect(
      service.canAccessField(
        currentUser,
        'ticket',
        field('secret'),
        'read',
        { creatorCompany: { handle: 99 } },
        templates,
      ),
    ).toBe(false);
  });

  it('rejects query use when a field is not readable across every entity stage', async () => {
    const globalDeny = permission('ticket', [
      {
        fieldName: 'secret',
        allowRead: false,
        allowInsert: true,
        allowUpdate: true,
      },
    ]);
    const currentUser = user([
      { stage: 'global', permissions: [globalDeny] },
      { stage: 'company', permissions: [permission('ticket')] },
    ]);

    await expect(
      service.assertReadableFields(currentUser, 'ticket', ['secret']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps security and read-only metadata as structural upper bounds', () => {
    const currentUser = user([
      { stage: 'global', permissions: [permission('ticket')] },
    ]);

    expect(
      service.canAccessField(
        currentUser,
        'ticket',
        field('password', ['isSecurity']),
        'read',
      ),
    ).toBe(false);
    expect(
      service.canAccessField(
        currentUser,
        'ticket',
        field('computed', ['isReadOnly']),
        'update',
      ),
    ).toBe(false);
  });

  it('does not grant administrators a data-access bypass', () => {
    const administratorWithoutEntityPermission = user([
      { stage: 'global', permissions: [] },
    ]);

    expect(
      service.canAccessField(
        administratorWithoutEntityPermission,
        'ticket',
        field('title'),
        'read',
      ),
    ).toBe(false);
  });

  it('keeps public bootstrap entities readable without user field permissions', async () => {
    await expect(
      service.assertReadableQuery(undefined, 'translation', {
        entity: { $in: ['login'] },
        language: 'de',
      }),
    ).resolves.toBeUndefined();

    expect(
      service.canAccessField(user([]), 'translation', field('value'), 'read'),
    ).toBe(true);
  });

  it('fails closed for anonymous reads of non-public entities', async () => {
    await expect(
      service.assertReadableFields(undefined, 'ticket', ['title']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
