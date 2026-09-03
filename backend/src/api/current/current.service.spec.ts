import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@mikro-orm/core', () => ({
  DeferMode: {
    INITIALLY_DEFERRED: 'deferred',
    INITIALLY_IMMEDIATE: 'immediate',
  },
  EntityManager: class {},
}));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../../entity/TicketItem', () => ({ TicketItem: class {} }));
jest.mock('../../entity/EventItem', () => ({ EventItem: class {} }));
jest.mock('../../entity/SalesOpportunityItem', () => ({
  SalesOpportunityItem: class {},
}));
jest.mock('../../entity/DashboardItem', () => ({
  DashboardItem: class {
    handle?: number;
    name?: string;
    person?: unknown;
    sortOrder = 100;
    kpiOrder: number[] = [];
    kpis = {
      items: [] as unknown[],
      add: (...items: unknown[]) => {
        this.kpis.items.push(...items);
      },
      getItems: () => this.kpis.items,
    };
  },
}));
jest.mock('../../entity/DashboardTemplateItem', () => ({
  DashboardTemplateItem: class {},
}));
jest.mock('../../entity/FavoriteItem', () => ({
  FavoriteItem: class {
    title?: string;
    person?: unknown;
    entity?: unknown;
    entityRoute?: unknown;
    filter?: unknown;
  },
}));
jest.mock('../../entity/FavoriteTemplateItem', () => ({
  FavoriteTemplateItem: class {},
}));
jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_HANDLES: [],
}));
jest.mock('../../entity/WorkHourWeekItem', () => ({
  WorkHourWeekItem: class {},
}));

import { CurrentService } from './current.service';

describe('CurrentService', () => {
  it('loads authorization relations without provisioning starter content', async () => {
    const person = { handle: 7, roles: [], loginPassword: 'secret' };
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(person);
    const count = jest.fn<(...args: unknown[]) => Promise<number>>();
    const persist = jest.fn();
    const service = new CurrentService(
      {
        fork: jest.fn(() => ({ findOne, count, persist })),
      } as never,
      {} as never,
    );

    await expect(service.getPerson({ handle: 7 })).resolves.toEqual({
      handle: 7,
      roles: [],
    });

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('provisions starter dashboards and favorites from role templates when none exist', async () => {
    const flush = jest.fn();
    const persist = jest.fn();
    const count = jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const hydratedPerson = {
      handle: 7,
      roles: [
        {
          starterDashboardTemplates: [
            {
              handle: 11,
              name: 'Support Cockpit',
              kpis: [{ handle: 101 }, { handle: 102 }],
            },
          ],
          starterFavoriteTemplates: [
            {
              handle: 21,
              name: 'Offene Tickets',
              entity: { handle: 'ticket' },
              entityRoute: { handle: 5, route: 'table/ticket' },
              filter: { status: { handle: 'open' } },
            },
          ],
        },
      ],
    };
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce(hydratedPerson)
      .mockResolvedValueOnce({
        handle: 7,
        roles: [],
        loginPassword: 'secret',
      });
    const fork = jest.fn(() => ({
      findOne,
      count,
      persist,
      flush,
    }));
    const em = {
      fork,
    };
    const service = new CurrentService(em as never, {} as never);

    const result = await service.getPersonWithStarterWorkspace({ handle: 7 });

    expect(count).toHaveBeenCalledWith(expect.anything(), {
      person: { handle: 7 },
    });
    expect(persist).toHaveBeenCalledTimes(2);
    const persistedDashboard = persist.mock.calls[0]?.[0] as
      | {
          kpis: {
            items: Array<{ handle: number }>;
          };
        }
      | undefined;
    expect(persist.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        name: 'Support Cockpit',
        person: hydratedPerson,
        sortOrder: 100,
        kpiOrder: [101, 102],
      }),
    );
    expect(persistedDashboard?.kpis.items).toEqual([
      { handle: 101 },
      { handle: 102 },
    ]);
    expect(persist.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        title: 'Offene Tickets',
        person: hydratedPerson,
        entity: { handle: 'ticket' },
        entityRoute: { handle: 5, route: 'table/ticket' },
        filter: { status: { handle: 'open' } },
      }),
    );
    expect(flush).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handle: 7, roles: [] });
  });

  it('atomically persists the complete dashboard and KPI order for the current person', async () => {
    const first = {
      handle: 3,
      person: { handle: 7 },
      sortOrder: 100,
      kpiOrder: [31, 32],
      kpis: { getItems: () => [{ handle: 31 }, { handle: 32 }] },
    };
    const second = {
      handle: 8,
      person: { handle: 7 },
      sortOrder: 200,
      kpiOrder: [81],
      kpis: { getItems: () => [{ handle: 81 }] },
    };
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue();
    const transactional = jest.fn(
      async (callback: (transactionEm: unknown) => Promise<unknown>) =>
        callback({
          find: jest
            .fn<(...args: unknown[]) => Promise<unknown[]>>()
            .mockResolvedValue([first, second]),
          flush,
        }),
    );
    const service = new CurrentService({ transactional } as never, {} as never);

    await expect(
      service.updateDashboardLayout(
        { handle: 7 },
        {
          dashboards: [
            { handle: 8, kpiOrder: [81] },
            { handle: 3, kpiOrder: [32, 31] },
          ],
        },
      ),
    ).resolves.toEqual({ updatedCount: 2, dashboardHandles: [8, 3] });

    expect(second).toEqual(
      expect.objectContaining({ sortOrder: 100, kpiOrder: [81] }),
    );
    expect(first).toEqual(
      expect.objectContaining({ sortOrder: 200, kpiOrder: [32, 31] }),
    );
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('rejects layouts that omit a dashboard or contain an invalid KPI assignment', async () => {
    const transactional = jest.fn(
      async (callback: (transactionEm: unknown) => Promise<unknown>) =>
        callback({
          find: jest
            .fn<(...args: unknown[]) => Promise<unknown[]>>()
            .mockResolvedValue([
              {
                handle: 3,
                kpis: { getItems: () => [{ handle: 31 }] },
              },
              {
                handle: 8,
                kpis: { getItems: () => [{ handle: 81 }] },
              },
            ]),
          flush: jest.fn(),
        }),
    );
    const service = new CurrentService({ transactional } as never, {} as never);

    await expect(
      service.updateDashboardLayout(
        { handle: 7 },
        { dashboards: [{ handle: 3, kpiOrder: [999] }] },
      ),
    ).rejects.toMatchObject({ message: 'dashboard.invalidLayout' });
  });

  it('builds an open-task snapshot from the assigned records and unread notifications', async () => {
    const ticket = { handle: 1 };
    const event = { handle: 2 };
    const salesOpportunity = { handle: 3 };
    const effortEstimate = { handle: 4 };
    const internalCase = { handle: 5 };
    const notification = { handle: 6 };
    const find = jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValueOnce([ticket])
      .mockResolvedValueOnce([event])
      .mockResolvedValueOnce([salesOpportunity])
      .mockResolvedValueOnce([effortEstimate])
      .mockResolvedValueOnce([internalCase]);
    const em = {
      find,
    };
    const inboxService = {
      getUnreadNotifications: jest
        .fn<(_user: { handle: number }) => Promise<unknown[]>>()
        .mockResolvedValue([notification]),
    };
    const service = new CurrentService(em as never, inboxService as never);

    const result = await service.getOpenTaskSnapshot({
      handle: 7,
    } as never);

    expect(result).toEqual({
      count: 6,
      tickets: [ticket],
      tasks: [event],
      salesOpportunities: [salesOpportunity],
      effortEstimates: [effortEstimate],
      internalCases: [internalCase],
      notifications: [notification],
    });
    expect(find).toHaveBeenCalledTimes(5);
    expect(find.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        assigneePerson: { handle: 7 },
        status: { handle: { $nin: ['closed'] } },
      }),
    );
    expect(find.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        $or: [
          {
            isPrivate: false,
            participants: { handle: 7 },
          },
          {
            isPrivate: true,
            $or: [
              { creatorPerson: { handle: 7 } },
              { participants: { handle: 7 } },
            ],
          },
        ],
        status: { handle: { $nin: ['canceled', 'completed'] } },
      }),
    );
    expect(find.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        assigneePerson: { handle: 7 },
        isActive: true,
      }),
    );
    expect(find.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        assigneePerson: { handle: 7 },
        isActive: true,
        status: { handle: { $nin: ['completed', 'cancelled'] } },
      }),
    );
    expect(find.mock.calls[4]?.[1]).toEqual(
      expect.objectContaining({
        responsiblePerson: { handle: 7 },
        status: { isOpen: true },
      }),
    );
    expect(inboxService.getUnreadNotifications).toHaveBeenCalledWith({
      handle: 7,
    });
  });
});
