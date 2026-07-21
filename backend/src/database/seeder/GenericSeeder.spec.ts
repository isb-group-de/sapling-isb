import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager, EntityName } from '@mikro-orm/core';
import { EntityRouteItem } from '../../entity/EntityRouteItem';
import { GenericSeeder } from './GenericSeeder';

jest.mock('@mikro-orm/seeder', () => ({
  Seeder: class {},
}));

type SeedItemUpdater = {
  updateExistingSeedItemByHandle(
    entityClass: EntityName<object>,
    item: object,
    em: EntityManager,
  ): Promise<boolean>;
};

describe('GenericSeeder', () => {
  it('updates an existing handle-keyed seed item', async () => {
    class ReferenceItem {}

    const existingItem = {
      handle: 'open',
      description: 'Open',
      color: '#4CAF50',
    };
    const em = {
      findOne: jest.fn<(...args: unknown[]) => Promise<typeof existingItem>>(
        () => Promise.resolve(existingItem),
      ),
      assign: jest.fn<(...args: unknown[]) => unknown>(),
    };
    const seedItem = {
      handle: 'open',
      description: 'Ready',
      color: '#2196F3',
    };
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    const updated = await seeder.updateExistingSeedItemByHandle(
      ReferenceItem,
      seedItem,
      em as unknown as EntityManager,
    );

    expect(updated).toBe(true);
    expect(em.findOne).toHaveBeenCalledWith(ReferenceItem, {
      handle: 'open',
    });
    expect(em.assign).toHaveBeenCalledWith(existingItem, seedItem);
  });

  it('updates an existing entity route by entity and route', async () => {
    const existingRoute = { handle: 42 };
    const em = {
      findOne: jest.fn<(...args: unknown[]) => Promise<typeof existingRoute>>(
        () => Promise.resolve(existingRoute),
      ),
      assign: jest.fn<(...args: unknown[]) => unknown>(),
    };
    const seedItem = {
      entity: 'emailTemplate',
      route: 'table/emailTemplate',
      group: 'emailInbound',
    };
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    const updated = await seeder.updateExistingSeedItemByHandle(
      EntityRouteItem,
      seedItem,
      em as unknown as EntityManager,
    );

    expect(updated).toBe(true);
    expect(em.findOne).toHaveBeenCalledWith(EntityRouteItem, {
      entity: { handle: 'emailTemplate' },
      route: 'table/emailTemplate',
    });
    expect(em.assign).toHaveBeenCalledWith(existingRoute, seedItem);
  });
});
