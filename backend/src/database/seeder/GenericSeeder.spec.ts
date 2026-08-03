import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager, EntityName } from '@mikro-orm/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EntityRouteItem } from '../../entity/EntityRouteItem';
import { KpiItem } from '../../entity/KpiItem';
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
  prepareSeedItem(
    entityHandle: string,
    item: object,
    em: EntityManager,
  ): Promise<object>;
};

describe('GenericSeeder', () => {
  it.each(['production', 'demonstration'])(
    'keeps the new %s dashboard seeds linked to existing KPI and template names',
    (dataset) => {
      const loadSeed = <T>(folder: string, fileName: string): T =>
        JSON.parse(
          readFileSync(
            join(__dirname, `json-${dataset}`, folder, fileName),
            'utf8',
          ),
        ) as T;
      const kpis = [
        ...loadSeed<Array<{ name: string }>>('kpi', 'kpiData_001.json'),
        ...loadSeed<Array<{ name: string }>>('kpi', 'kpiData_002.json'),
      ];
      const dashboards = [
        ...loadSeed<Array<{ name: string; kpis: Array<number | string> }>>(
          'dashboardTemplate',
          'dashboardTemplateData_001.json',
        ),
        ...loadSeed<Array<{ name: string; kpis: Array<number | string> }>>(
          'dashboardTemplate',
          'dashboardTemplateData_002.json',
        ),
      ];
      const roleMappings = loadSeed<
        Array<{ role: string; templates: string[] }>
      >('roleStarterDashboard', 'roleStarterDashboardData_002.json');
      const kpiNames = new Set(kpis.map((kpi) => kpi.name));
      const dashboardNames = new Set(
        dashboards.map((dashboard) => dashboard.name),
      );

      for (const dashboard of dashboards) {
        for (const kpiReference of dashboard.kpis) {
          expect(typeof kpiReference).toBe('string');
          if (typeof kpiReference !== 'string') continue;
          expect(kpiNames).toContain(kpiReference);
        }
      }

      for (const roleMapping of roleMappings) {
        for (const templateName of roleMapping.templates) {
          expect(dashboardNames).toContain(templateName);
        }
      }
    },
  );

  it('resolves dashboard-template KPI names without relying on numeric handles', async () => {
    const openTickets = { handle: 7, name: 'Offene Tickets' };
    const ticketTrend = {
      handle: 23,
      name: 'Gelöste Tickets Jahresvergleich',
    };
    const em = {
      findOne: jest.fn<(...args: unknown[]) => Promise<object | null>>(
        (_entity, criteria) => {
          const name = (criteria as { name?: string }).name;
          return Promise.resolve(
            name === openTickets.name
              ? openTickets
              : name === ticketTrend.name
                ? ticketTrend
                : null,
          );
        },
      ),
    };
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    const prepared = await seeder.prepareSeedItem(
      'dashboardTemplate',
      {
        name: 'Support Operations',
        kpis: [openTickets.name, ticketTrend.name],
      },
      em as unknown as EntityManager,
    );

    expect(prepared).toEqual({
      name: 'Support Operations',
      kpis: [openTickets, ticketTrend],
    });
    expect(em.findOne).toHaveBeenCalledWith(KpiItem, {
      name: openTickets.name,
    });
    expect(em.findOne).toHaveBeenCalledWith(KpiItem, {
      name: ticketTrend.name,
    });
  });

  it('fails a dashboard-template seed when a named KPI is missing', async () => {
    const em = {
      findOne: jest.fn<(...args: unknown[]) => Promise<null>>(() =>
        Promise.resolve(null),
      ),
    };
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    await expect(
      seeder.prepareSeedItem(
        'dashboardTemplate',
        { name: 'Broken template', kpis: ['Missing KPI'] },
        em as unknown as EntityManager,
      ),
    ).rejects.toThrow(
      'Dashboard template seeding failed. Unknown KPI: Missing KPI',
    );
  });

  it('rejects numeric KPI references in dashboard-template seeds', async () => {
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    await expect(
      seeder.prepareSeedItem(
        'dashboardTemplate',
        { name: 'Legacy template', kpis: [1] },
        {} as EntityManager,
      ),
    ).rejects.toThrow(
      'Dashboard template seeding failed. KPI references must use names.',
    );
  });

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

  it('updates an existing entity route by entity, route, and group', async () => {
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
      group: { handle: 'emailInbound' },
    });
    expect(em.assign).toHaveBeenCalledWith(existingRoute, seedItem);
  });

  it('uses the null group as part of the default entity-route key', async () => {
    const existingRoute = { handle: 43 };
    const em = {
      findOne: jest.fn<(...args: unknown[]) => Promise<typeof existingRoute>>(
        () => Promise.resolve(existingRoute),
      ),
      assign: jest.fn<(...args: unknown[]) => unknown>(),
    };
    const seedItem = {
      entity: 'event',
      route: 'event',
      navigation: 'calendar',
    };
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    const updated = await seeder.updateExistingSeedItemByHandle(
      EntityRouteItem,
      seedItem,
      em as unknown as EntityManager,
    );

    expect(updated).toBe(true);
    expect(em.findOne).toHaveBeenCalledWith(EntityRouteItem, {
      entity: { handle: 'event' },
      route: 'event',
      group: null,
    });
    expect(em.assign).toHaveBeenCalledWith(existingRoute, seedItem);
  });

  it('does not update an entity route from a different navigation group', async () => {
    const em = {
      findOne: jest.fn<(...args: unknown[]) => Promise<null>>(() =>
        Promise.resolve(null),
      ),
      assign: jest.fn<(...args: unknown[]) => unknown>(),
    };
    const seedItem = {
      entity: 'event',
      route: 'event',
      navigation: 'calendar',
      group: 'salesCalendar',
    };
    const seeder = new GenericSeeder() as unknown as SeedItemUpdater;

    const updated = await seeder.updateExistingSeedItemByHandle(
      EntityRouteItem,
      seedItem,
      em as unknown as EntityManager,
    );

    expect(updated).toBe(false);
    expect(em.findOne).toHaveBeenCalledWith(EntityRouteItem, {
      entity: { handle: 'event' },
      route: 'event',
      group: { handle: 'salesCalendar' },
    });
    expect(em.assign).not.toHaveBeenCalled();
  });
});
