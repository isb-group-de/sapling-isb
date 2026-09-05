import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import type { GenericPermissionGuard } from '../../../auth/guard/generic-permission.guard';
import type { PersonItem } from '../../../entity/PersonItem';
import type { CurrentService } from '../../current/current.service';
import type { FieldPermissionService } from '../../current/field-permission.service';
import type { GenericPermissionService } from '../generic-permission.service';
import type { GenericQueryService } from '../generic-query.service';
import type { GenericReferenceService } from '../generic-reference.service';
import { GenericMergeAccessService } from './generic-merge-access.service';

function setup() {
  const permission = { allowRead: true, allowUpdate: true, allowDelete: true };
  const em = {
    count: jest.fn(() => Promise.resolve(1)),
    findOne: jest.fn(() => Promise.resolve(null)),
  };
  const permissions = {
    setTopLevelFilter: jest.fn(() => ({ visible: true })),
    checkTopLevelPermission: jest.fn(),
  };
  const fields = { assertPayloadAccess: jest.fn(() => Promise.resolve()) };
  const guard = {
    assertPermissionForRequest: jest.fn(() => Promise.resolve()),
  };
  const service = new GenericMergeAccessService(
    em as unknown as EntityManager,
    { getEntityPermissions: () => permission } as unknown as CurrentService,
    permissions as unknown as GenericPermissionService,
    fields as unknown as FieldPermissionService,
    { getEntityClass: () => 'Record' } as unknown as GenericQueryService,
    {
      getHandleFilter: () => ({ handle: 1 }),
    } as unknown as GenericReferenceService,
    guard as unknown as GenericPermissionGuard,
  );
  const user = { handle: 9 } as PersonItem;
  return { service, permission, permissions, fields, guard, em, user };
}

describe('generic merge authorization', () => {
  it.each(['allowRead', 'allowUpdate', 'allowDelete'] as const)(
    'requires %s on the merged entity',
    (action) => {
      const { service, permission, user } = setup();
      permission[action] = false;
      expect(() => service.assertEntityAccess('company', user)).toThrow(
        ForbiddenException,
      );
    },
  );

  it('does not load a record outside the user visibility filter', async () => {
    const { service, em, user } = setup();
    await expect(
      service.loadRecord('company', 1, user, false),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(em.findOne).toHaveBeenCalledWith(
      'Record',
      { visible: true },
      { refresh: true },
    );
  });

  it('requires related read and update permissions before changing a link', async () => {
    const { service, permission, fields, user } = setup();
    permission.allowUpdate = false;
    await expect(
      service.assertRelationAccess(
        'person',
        { handle: 1 },
        { company: 2 },
        user,
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fields.assertPayloadAccess).not.toHaveBeenCalled();
  });

  it('preserves special generic guard restrictions for internal relationship updates', async () => {
    const { service, guard, fields, user } = setup();
    guard.assertPermissionForRequest.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      service.assertRelationAccess(
        'person',
        { handle: 1 },
        { company: 2 },
        user,
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fields.assertPayloadAccess).not.toHaveBeenCalled();
  });

  it('checks related record and field scopes before and after the move', async () => {
    const { service, permissions, fields, user } = setup();
    const before = { handle: 1, company: 10 };
    const after = { handle: 1, company: 20 };
    await service.assertRelationAccess(
      'person',
      before,
      { company: 20 },
      user,
      [],
    );
    expect(permissions.checkTopLevelPermission).toHaveBeenCalledWith(
      'person',
      before,
      user,
      'allowUpdateStage',
    );
    expect(permissions.checkTopLevelPermission).toHaveBeenCalledWith(
      'person',
      after,
      user,
      'allowUpdateStage',
    );
    expect(fields.assertPayloadAccess).toHaveBeenCalledWith(
      user,
      'person',
      { company: 20 },
      'update',
      before,
      [],
    );
    expect(fields.assertPayloadAccess).toHaveBeenCalledWith(
      user,
      'person',
      { company: 20 },
      'update',
      after,
      [],
    );
  });

  it('refuses a link on a related record hidden by its read scope', async () => {
    const { service, em, fields, user } = setup();
    em.count.mockResolvedValueOnce(0);
    await expect(
      service.assertRelationAccess(
        'person',
        { handle: 1 },
        { company: 2 },
        user,
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fields.assertPayloadAccess).not.toHaveBeenCalled();
  });
});
