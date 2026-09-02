import { GlobalSearchService } from './global-search.service';
import { EntityItem } from '../../entity/EntityItem';

describe('GlobalSearchService workspace and reference behavior', () => {
  it('prefers calendar and partner workspaces for record paths', async () => {
    const eventEntity = Object.assign(new EntityItem(), {
      handle: 'event',
      icon: 'mdi-calendar',
      canShow: true,
      routes: {
        getItems: () => [
          { route: 'partner/event' },
          { route: 'event', navigation: 'calendar' },
        ],
      },
    });
    const ticketEntity = Object.assign(new EntityItem(), {
      handle: 'ticket',
      icon: 'mdi-ticket',
      canShow: true,
      routes: {
        getItems: () => [{ route: 'partner/ticket' }],
      },
    });
    const em = {
      find: jest.fn().mockResolvedValue([eventEntity, ticketEntity]),
    };
    const currentUser = { handle: 1 };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'event',
          allowRead: true,
          allowShow: true,
        },
        {
          entityHandle: 'ticket',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findAndCount: jest.fn((entityHandle: string) =>
        Promise.resolve({
          data: [
            entityHandle === 'event'
              ? {
                  handle: 34,
                  title: 'Standardtermin',
                }
              : {
                  handle: 56,
                  title: 'Standardticket',
                },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 3,
            totalPages: 1,
            executionTime: 0,
          },
        }),
      ),
    };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        {
          name: 'title',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isValue'],
        },
      ]),
    };
    const service = new GlobalSearchService(
      em as never,
      currentService as never,
      genericService as never,
      templateService as never,
    );

    const result = await service.search(currentUser as never, {
      query: 'standard',
    });

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityHandle: 'event',
          path: '/event?filter=%7B%22handle%22%3A34%7D&open=34',
        }),
        expect.objectContaining({
          entityHandle: 'ticket',
          path: '/partner/ticket?filter=%7B%22handle%22%3A56%7D&open=56',
        }),
      ]),
    );
  });

  it('does not search entities explicitly disabled for reads', async () => {
    const disabledEntity = Object.assign(new EntityItem(), {
      handle: 'internalThing',
      canRead: false,
      canShow: true,
    });
    const personEntity = Object.assign(new EntityItem(), {
      handle: 'person',
      canShow: true,
      routes: {
        getItems: () => [{ route: 'table/person' }],
      },
    });
    const em = {
      find: jest.fn().mockResolvedValue([disabledEntity, personEntity]),
    };
    const currentUser = { handle: 1 };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'internalThing',
          allowRead: true,
          allowShow: true,
        },
        {
          entityHandle: 'person',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findAndCount: jest.fn().mockResolvedValue({
        data: [
          {
            handle: 42,
            firstName: 'Dirk',
            lastName: 'Schramm',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 3,
          totalPages: 1,
          executionTime: 0,
        },
      }),
    };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        {
          name: 'firstName',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isValue'],
        },
        {
          name: 'lastName',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isValue'],
        },
      ]),
    };
    const service = new GlobalSearchService(
      em as never,
      currentService as never,
      genericService as never,
      templateService as never,
    );

    const result = await service.search(currentUser as never, {
      query: 'Dirk',
    });

    expect(templateService.getEntityTemplate).toHaveBeenCalledTimes(1);
    expect(templateService.getEntityTemplate).toHaveBeenCalledWith('person');
    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'person',
      {
        $or: [
          {
            firstName: {
              $ilike: '%Dirk%',
            },
          },
          {
            lastName: {
              $ilike: '%Dirk%',
            },
          },
        ],
      },
      1,
      10,
      {},
      currentUser,
      [],
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        entityHandle: 'person',
        label: 'Dirk Schramm',
      }),
    ]);
  });

  it('searches and displays isValue references on a separate line', async () => {
    const personEntity = Object.assign(new EntityItem(), {
      handle: 'person',
      icon: 'mdi-account',
      canShow: true,
      routes: {
        getItems: () => [{ route: 'table/person' }],
      },
    });
    const em = {
      find: jest.fn().mockResolvedValue([personEntity]),
    };
    const currentUser = { handle: 1 };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'person',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findAndCount: jest.fn().mockResolvedValue({
        data: [
          {
            handle: 42,
            firstName: 'Max',
            lastName: 'Mustermann',
            company: {
              handle: 7,
              name: 'Standardfirma GmbH',
            },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          executionTime: 0,
        },
      }),
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) =>
        entityHandle === 'company'
          ? [
              {
                name: 'name',
                type: 'string',
                isPersistent: true,
                isReference: false,
                options: ['isValue'],
              },
            ]
          : [
              {
                name: 'firstName',
                type: 'string',
                isPersistent: true,
                isReference: false,
                options: ['isValue'],
              },
              {
                name: 'lastName',
                type: 'string',
                isPersistent: true,
                isReference: false,
                options: ['isValue'],
              },
              {
                name: 'company',
                type: 'CompanyItem',
                kind: 'm:1',
                referenceName: 'company',
                isPersistent: true,
                isReference: true,
                options: ['isValue'],
              },
            ],
      ),
    };
    const service = new GlobalSearchService(
      em as never,
      currentService as never,
      genericService as never,
      templateService as never,
    );

    const result = await service.search(currentUser as never, {
      query: 'standardfirma',
    });

    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'person',
      {
        $or: [
          {
            firstName: {
              $ilike: '%standardfirma%',
            },
          },
          {
            lastName: {
              $ilike: '%standardfirma%',
            },
          },
          {
            'company.name': {
              $ilike: '%standardfirma%',
            },
          },
        ],
      },
      1,
      10,
      {},
      currentUser,
      ['company'],
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        entityHandle: 'person',
        label: 'Max Mustermann\nStandardfirma GmbH',
        matches: [
          {
            field: 'company.name',
            value: 'Standardfirma GmbH',
          },
        ],
      }),
    ]);
  });

  it('resolves a shared reference template only once per search request', async () => {
    const entities = ['person', 'ticket'].map((handle) =>
      Object.assign(new EntityItem(), {
        handle,
        canShow: true,
        routes: {
          getItems: () => [{ route: `table/${handle}` }],
        },
      }),
    );
    const currentUser = { handle: 1 };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) =>
        entityHandle === 'company'
          ? [
              {
                name: 'name',
                type: 'string',
                isPersistent: true,
                isReference: false,
                options: ['isValue'],
              },
            ]
          : [
              {
                name: 'title',
                type: 'string',
                isPersistent: true,
                isReference: false,
                options: ['isValue'],
              },
              {
                name: 'company',
                type: 'CompanyItem',
                kind: 'm:1',
                referenceName: 'company',
                isPersistent: true,
                isReference: true,
                options: ['isValue'],
              },
            ],
      ),
    };
    const service = new GlobalSearchService(
      { find: jest.fn().mockResolvedValue(entities) } as never,
      {
        getPerson: jest.fn().mockResolvedValue(currentUser),
        getAllEntityPermissions: jest.fn().mockReturnValue(
          entities.map((entity) => ({
            entityHandle: entity.handle,
            allowRead: true,
            allowShow: true,
          })),
        ),
      } as never,
      {
        findAndCount: jest.fn().mockResolvedValue({ data: [] }),
      } as never,
      templateService as never,
    );

    await service.search(currentUser as never, { query: 'standard' });

    expect(
      templateService.getEntityTemplate.mock.calls.filter(
        ([entityHandle]) => entityHandle === 'company',
      ),
    ).toHaveLength(1);
  });
});
