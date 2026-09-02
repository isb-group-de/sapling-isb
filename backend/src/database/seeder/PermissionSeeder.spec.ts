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
    ROLE_HANDLE.SUPPORT,
    ROLE_HANDLE.SALES,
    ROLE_HANDLE.CUSTOMER,
    ROLE_HANDLE.CONTRACTOR,
  ])(
    'grants standard role %s full personal favorite lifecycle access',
    async (roleHandle) => {
      const entity = {
        handle: 'favorite',
        canRead: false,
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
        allowInsert: true,
        allowUpdate: true,
        allowDelete: true,
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

  it.each([
    'systemTelemetryEnvironment',
    'systemErrorGroup',
    'systemErrorOccurrence',
    'systemCheckRun',
    'systemRemediationExecution',
    'systemCanaryRecord',
  ])('grants only administrators access to %s', async (entityHandle) => {
    const entity = {
      handle: entityHandle,
      canRead: true,
      canInsert: false,
      canUpdate: false,
      canDelete: false,
      canShow: true,
    } as EntityItem;
    const roles = [
      ROLE_HANDLE.ADMIN,
      ROLE_HANDLE.SUPPORT,
      ROLE_HANDLE.SALES,
      ROLE_HANDLE.CUSTOMER,
      ROLE_HANDLE.CONTRACTOR,
    ].map((handle) => ({ handle }) as RoleItem);
    const em = {
      findAll: jest.fn((entityClass: unknown) => {
        if (entityClass === EntityItem) return Promise.resolve([entity]);
        if (entityClass === RoleItem) return Promise.resolve(roles);
        return Promise.resolve([]);
      }),
      assign: jest.fn(),
      create: jest.fn(),
      flush: jest.fn(() => Promise.resolve()),
    };

    await new PermissionSeeder().run(em as unknown as EntityManager);

    const grantsByRole = new Map(
      em.create.mock.calls.map(([, permission]) => [
        (permission as { role: RoleItem }).role.handle,
        permission as {
          allowRead: boolean;
          allowShow: boolean;
        },
      ]),
    );
    expect(grantsByRole.get(ROLE_HANDLE.ADMIN)).toMatchObject({
      allowRead: true,
      allowShow: true,
    });
    for (const roleHandle of [
      ROLE_HANDLE.SUPPORT,
      ROLE_HANDLE.SALES,
      ROLE_HANDLE.CUSTOMER,
      ROLE_HANDLE.CONTRACTOR,
    ]) {
      expect(grantsByRole.get(roleHandle)).toMatchObject({
        allowRead: false,
        allowShow: false,
      });
    }
  });
});
