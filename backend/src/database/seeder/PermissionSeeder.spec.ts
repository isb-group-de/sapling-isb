import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { PermissionItem } from '../../entity/PermissionItem';
import { RoleItem } from '../../entity/RoleItem';
import { PermissionSeeder } from './PermissionSeeder';
import { ROLE_HANDLE } from './role-handles';

jest.mock('@mikro-orm/seeder', () => ({
  Seeder: class {},
}));

describe('PermissionSeeder', () => {
  it('synchronizes existing administrator permissions with entity capabilities', async () => {
    const entity = {
      handle: 'eventStatus',
      canRead: true,
      canInsert: true,
      canUpdate: true,
      canDelete: true,
      canShow: true,
    } as EntityItem;
    const role = { handle: ROLE_HANDLE.ADMIN } as RoleItem;
    const permission = {
      entity,
      role,
      allowRead: true,
      allowInsert: false,
      allowUpdate: true,
      allowDelete: false,
      allowShow: true,
    } as PermissionItem;
    const em = {
      findAll: jest.fn((entityClass: unknown) => {
        if (entityClass === EntityItem) return Promise.resolve([entity]);
        if (entityClass === RoleItem) return Promise.resolve([role]);
        return Promise.resolve([permission]);
      }),
      assign: jest.fn(),
      create: jest.fn(),
      flush: jest.fn(() => Promise.resolve()),
    };

    await new PermissionSeeder().run(em as unknown as EntityManager);

    expect(em.assign).toHaveBeenCalledWith(permission, {
      allowRead: true,
      allowInsert: true,
      allowUpdate: true,
      allowDelete: true,
      allowShow: true,
    });
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an existing non-administrator permission', async () => {
    const entity = {
      handle: 'eventStatus',
      canRead: true,
      canInsert: true,
      canUpdate: true,
      canDelete: true,
      canShow: true,
    } as EntityItem;
    const role = { handle: ROLE_HANDLE.SUPPORT } as RoleItem;
    const permission = {
      entity,
      role,
      allowRead: true,
      allowInsert: false,
      allowUpdate: false,
      allowDelete: false,
      allowShow: true,
    } as PermissionItem;
    const em = {
      findAll: jest.fn((entityClass: unknown) => {
        if (entityClass === EntityItem) return Promise.resolve([entity]);
        if (entityClass === RoleItem) return Promise.resolve([role]);
        return Promise.resolve([permission]);
      }),
      assign: jest.fn(),
      create: jest.fn(),
      flush: jest.fn(() => Promise.resolve()),
    };

    await new PermissionSeeder().run(em as unknown as EntityManager);

    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it.each([ROLE_HANDLE.SUPPORT, ROLE_HANDLE.SALES])(
    'grants standard role %s read access to email delivery statuses',
    async (roleHandle) => {
      const entity = {
        handle: 'emailDeliveryStatus',
        canRead: true,
        canInsert: true,
        canUpdate: true,
        canDelete: true,
        canShow: true,
      } as EntityItem;
      const role = { handle: roleHandle } as RoleItem;
      const em = {
        findAll: jest.fn((entityClass: unknown) => {
          if (entityClass === EntityItem) return Promise.resolve([entity]);
          if (entityClass === RoleItem) return Promise.resolve([role]);
          return Promise.resolve([]);
        }),
        assign: jest.fn(),
        create: jest.fn(),
        flush: jest.fn(() => Promise.resolve()),
      };

      await new PermissionSeeder().run(em as unknown as EntityManager);

      expect(em.create).toHaveBeenCalledWith(PermissionItem, {
        entity,
        role,
        allowRead: true,
        allowInsert: false,
        allowUpdate: false,
        allowDelete: false,
        allowShow: false,
      });
    },
  );

  it.each([
    [ROLE_HANDLE.SUPPORT, 'aiProviderType'],
    [ROLE_HANDLE.SUPPORT, 'aiProviderModel'],
    [ROLE_HANDLE.SALES, 'aiProviderType'],
    [ROLE_HANDLE.SALES, 'aiProviderModel'],
  ])(
    'grants AI-enabled standard role %s read access to %s without navigation visibility',
    async (roleHandle, entityHandle) => {
      const entity = {
        handle: entityHandle,
        canRead: true,
        canInsert: true,
        canUpdate: true,
        canDelete: true,
        canShow: true,
      } as EntityItem;
      const role = { handle: roleHandle } as RoleItem;
      const em = {
        findAll: jest.fn((entityClass: unknown) => {
          if (entityClass === EntityItem) return Promise.resolve([entity]);
          if (entityClass === RoleItem) return Promise.resolve([role]);
          return Promise.resolve([]);
        }),
        assign: jest.fn(),
        create: jest.fn(),
        flush: jest.fn(() => Promise.resolve()),
      };

      await new PermissionSeeder().run(em as unknown as EntityManager);

      expect(em.create).toHaveBeenCalledWith(PermissionItem, {
        entity,
        role,
        allowRead: true,
        allowInsert: false,
        allowUpdate: false,
        allowDelete: false,
        allowShow: false,
      });
    },
  );
});
