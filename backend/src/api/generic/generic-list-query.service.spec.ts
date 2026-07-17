import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../constants/project.constants', () => ({
  GENERIC_DOWNLOAD_LIMIT: 2,
}));

import { GenericListQueryService } from './generic-list-query.service';

function createSubject(
  overrides: {
    find?: jest.Mock;
    findAndCount?: jest.Mock;
  } = {},
) {
  const templateService = {
    getEntityTemplate: jest.fn(() => []),
  };
  const genericQueryService = {
    getEntityClass: jest.fn(() => class TestEntity {}),
    normalizeQueryCriteria: jest.fn(
      (_entityHandle: string, value: object, mode?: string) => {
        void mode;
        return value;
      },
    ),
    collectQueryPopulateRelations: jest.fn(() => []),
    buildPopulate: jest.fn(() => ['owner']),
    buildFields: jest.fn(() => ['handle']),
  };
  const genericReadService = {
    find:
      overrides.find ??
      jest.fn(() => Promise.resolve({ items: [{ handle: 1 }], entity: {} })),
    findAndCount:
      overrides.findAndCount ??
      jest.fn(() =>
        Promise.resolve({ items: [{ handle: 1 }], total: 1, entity: {} }),
      ),
    applyAfterRead: jest.fn((items: object[]) => Promise.resolve(items)),
  };
  const genericSanitizerService = {
    sanitizeEntityResult: jest.fn(
      (_entityHandle: string, items: object[]) => items,
    ),
    projectEntityResult: jest.fn(
      <T>(_entityHandle: string, items: T): T => items,
    ),
  };
  const genericCustomFieldService = {
    applyCustomFieldFilters: jest.fn((_entityHandle: string, where: object) =>
      Promise.resolve(where),
    ),
    hydrateRecords: jest.fn((_entityHandle: string, items: object[]) =>
      Promise.resolve(items),
    ),
  };

  return {
    service: new GenericListQueryService(
      templateService as never,
      genericQueryService as never,
      genericReadService as never,
      genericSanitizerService as never,
      genericCustomFieldService as never,
    ),
    genericQueryService,
    genericReadService,
    genericCustomFieldService,
  };
}

describe('GenericListQueryService', () => {
  it('runs the complete list pipeline and excludes custom-field sorting from ORM orderBy', async () => {
    const { service, genericQueryService, genericReadService } =
      createSubject();

    const result = await service.findAndCount(
      'ticket',
      { title: { $like: 'Open' } },
      1,
      25,
      { title: 'ASC', 'customFields.priority': 'DESC' },
      { handle: 7 } as never,
      ['owner'],
      ['handle'],
    );

    expect(genericQueryService.normalizeQueryCriteria).toHaveBeenCalledWith(
      'ticket',
      { title: 'ASC' },
      'orderBy',
    );
    expect(genericReadService.findAndCount).toHaveBeenCalledWith(
      'ticket',
      expect.any(Function),
      { title: { $like: 'Open' } },
      { handle: 7 },
      [],
      expect.objectContaining({
        limit: 25,
        offset: 0,
        populate: ['owner'],
        fields: ['handle'],
      }),
    );
    expect(result.data).toEqual([{ handle: 1 }]);
    expect(result.meta).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 25, totalPages: 1 }),
    );
  });

  it('sanitizes and hydrates JSON exports', async () => {
    const { service, genericCustomFieldService } = createSubject();

    const result = await service.downloadJSON(
      'ticket',
      {},
      {},
      { handle: 7 } as never,
      ['owner'],
    );

    expect(JSON.parse(result)).toEqual([{ handle: 1 }]);
    expect(genericCustomFieldService.hydrateRecords).toHaveBeenCalledWith(
      'ticket',
      [{ handle: 1 }],
    );
  });

  it('rejects exports above the configured download limit', async () => {
    const find = jest.fn(() =>
      Promise.resolve({
        items: [{ handle: 1 }, { handle: 2 }, { handle: 3 }],
        entity: {},
      }),
    );
    const { service } = createSubject({ find });

    await expect(
      service.downloadJSON('ticket', {}, {}, { handle: 7 } as never, []),
    ).rejects.toMatchObject({ message: 'exception.exportLimitExceeded' });
  });
});
