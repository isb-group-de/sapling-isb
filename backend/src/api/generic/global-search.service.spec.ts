import { ValidationPipe } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';
import { EntityItem } from '../../entity/EntityItem';
import { GlobalSearchQueryDto } from './dto/global-search.dto';

describe('GlobalSearchService', () => {
  it('does not expose search-index rows through global search', async () => {
    const currentUser = { handle: 1 };
    const em = { find: jest.fn() };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'globalSearchIndex',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findWithoutCount: jest.fn(),
      findAndCount: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest.fn(),
    };
    const searchIndex = {
      isEnabled: jest.fn().mockReturnValue(true),
      findCandidates: jest.fn(),
    };
    const service = new GlobalSearchService(
      em as never,
      currentService as never,
      genericService as never,
      templateService as never,
      undefined,
      searchIndex as never,
    );

    await expect(
      service.search(currentUser as never, {
        query: 'company',
        limit: 5,
      }),
    ).resolves.toEqual({ query: 'company', items: [] });

    expect(em.find).not.toHaveBeenCalled();
    expect(templateService.getEntityTemplate).not.toHaveBeenCalled();
    expect(searchIndex.findCandidates).not.toHaveBeenCalled();
  });

  it('uses indexed candidates and rechecks records through generic security', async () => {
    const entity = Object.assign(new EntityItem(), {
      handle: 'company',
      canRead: true,
      canShow: true,
      routes: [{ route: 'table/company' }],
    });
    const currentUser = { handle: 1, roles: [] };
    const em = { find: jest.fn().mockResolvedValue([entity]) };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'company',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findWithoutCount: jest.fn().mockResolvedValue([
        {
          handle: 12,
          name: 'Standardfirma GmbH',
        },
      ]),
      findAndCount: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([
        {
          name: 'handle',
          type: 'number',
          isPersistent: true,
          isReference: false,
          options: [],
        },
        {
          name: 'name',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isValue'],
        },
        {
          name: 'secret',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isSecurity'],
        },
      ]),
    };
    const searchIndex = {
      isEnabled: jest.fn().mockReturnValue(true),
      findCandidates: jest.fn().mockResolvedValue([
        {
          entityHandle: 'company',
          recordHandle: '12',
          fieldPath: 'name',
          fieldValue: 'Standardfirma GmbH',
        },
      ]),
    };
    const service = new GlobalSearchService(
      em as never,
      currentService as never,
      genericService as never,
      templateService as never,
      undefined,
      searchIndex as never,
    );

    const result = await service.search(currentUser as never, {
      query: 'standard',
      limit: 5,
    });

    expect(searchIndex.findCandidates).toHaveBeenCalledWith(
      [{ entityHandle: 'company', fieldPaths: ['name'] }],
      'standard',
      50,
    );
    expect(genericService.findWithoutCount).toHaveBeenCalledWith(
      'company',
      { handle: { $in: [12] } },
      1,
      {},
      currentUser,
      [],
    );
    expect(genericService.findAndCount).not.toHaveBeenCalled();
    expect(result.items).toEqual([
      expect.objectContaining({
        entityHandle: 'company',
        recordHandle: 12,
        label: 'Standardfirma GmbH',
      }),
    ]);
  });

  it('keeps query parameters through the global whitelist validation pipe', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
    });

    const result = (await pipe.transform(
      {
        query: 'Dirk',
        limit: '10',
        extra: 'ignored',
      },
      {
        type: 'query',
        metatype: GlobalSearchQueryDto,
      },
    )) as GlobalSearchQueryDto;

    expect(result).toEqual({
      query: 'Dirk',
      limit: '10',
    });
  });

  it('searches readable visible entities through the generic service', async () => {
    const entity = Object.assign(new EntityItem(), {
      handle: 'company',
      icon: 'mdi-domain',
      canShow: true,
      routes: {
        getItems: () => [{ route: 'table/company' }],
      },
    });
    const em = {
      find: jest.fn().mockResolvedValue([entity]),
    };
    const currentUser = { handle: 1 };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'company',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findAndCount: jest.fn().mockResolvedValue({
        data: [
          {
            handle: 12,
            name: 'Standardfirma GmbH',
            email: 'info@standardfirma.de',
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
          name: 'handle',
          type: 'number',
          isPersistent: true,
          isReference: false,
          options: [],
        },
        {
          name: 'name',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isValue'],
        },
        {
          name: 'email',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: [],
        },
        {
          name: 'externalKeyHash',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isValue', 'isSearchExcluded'],
        },
        {
          name: 'loginPassword',
          type: 'string',
          isPersistent: true,
          isReference: false,
          options: ['isSecurity'],
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
      limit: 5,
    });

    expect(em.find).toHaveBeenCalledWith(
      EntityItem,
      {
        handle: { $in: ['company'] },
        canShow: true,
      },
      {
        populate: ['routes'],
        orderBy: { order: 'ASC', handle: 'ASC' },
      },
    );
    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'company',
      {
        $or: [
          {
            name: {
              $ilike: '%standard%',
            },
          },
          {
            email: {
              $ilike: '%standard%',
            },
          },
        ],
      },
      1,
      5,
      {},
      currentUser,
      [],
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        entityHandle: 'company',
        recordHandle: 12,
        label: 'Standardfirma GmbH',
        icon: 'mdi-domain',
        path: '/table/company?filter=%7B%22handle%22%3A12%7D&open=12',
      }),
    ]);
  });

  it('skips entities whose template cannot be resolved', async () => {
    const staleEntity = Object.assign(new EntityItem(), {
      handle: 'staleEntity',
      canRead: true,
      canShow: true,
      routes: {
        getItems: () => [{ route: 'table/staleEntity' }],
      },
    });
    const companyEntity = Object.assign(new EntityItem(), {
      handle: 'company',
      icon: 'mdi-domain',
      canRead: true,
      canShow: true,
      routes: {
        getItems: () => [{ route: 'table/company' }],
      },
    });
    const em = {
      find: jest.fn().mockResolvedValue([staleEntity, companyEntity]),
    };
    const currentUser = { handle: 1 };
    const currentService = {
      getPerson: jest.fn().mockResolvedValue(currentUser),
      getAllEntityPermissions: jest.fn().mockReturnValue([
        {
          entityHandle: 'staleEntity',
          allowRead: true,
          allowShow: true,
        },
        {
          entityHandle: 'company',
          allowRead: true,
          allowShow: true,
        },
      ]),
    };
    const genericService = {
      findAndCount: jest.fn().mockResolvedValue({
        data: [
          {
            handle: 12,
            name: 'Standardfirma GmbH',
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
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'staleEntity') {
          throw new Error('missing template');
        }

        return [
          {
            name: 'name',
            type: 'string',
            isPersistent: true,
            isReference: false,
            options: ['isValue'],
          },
        ];
      }),
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

    expect(templateService.getEntityTemplate).toHaveBeenCalledWith(
      'staleEntity',
    );
    expect(templateService.getEntityTemplate).toHaveBeenCalledWith('company');
    expect(genericService.findAndCount).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        entityHandle: 'company',
        label: 'Standardfirma GmbH',
      }),
    ]);
  });
});
