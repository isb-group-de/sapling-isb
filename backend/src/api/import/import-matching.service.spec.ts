import { describe, expect, it, jest } from '@jest/globals';
import { ImportMatchingService } from './import-matching.service';

describe('ImportMatchingService', () => {
  const template = [
    {
      name: 'name',
      isPersistent: true,
      kind: 'scalar',
      options: ['isValue'],
    },
  ];

  it('recommends an update immediately for an external record link', async () => {
    const row = { rowNumber: 2, rawData: { Name: 'Sapling' } };
    const em = { find: jest.fn(() => Promise.resolve([row])) };
    const genericService = { findAndCount: jest.fn() };
    const service = new ImportMatchingService(
      em as never,
      genericService as never,
      { getEntityTemplate: () => template } as never,
    );

    const result = await service.matchBatch(
      {
        handle: 11,
        headers: ['Name'],
        mapping: { mappings: [{ sourceColumn: 'Name', targetField: 'name' }] },
      } as never,
      { entityHandle: 'company' },
      {} as never,
      async () => '42',
    );

    expect(result.rows).toEqual([
      expect.objectContaining({
        recommendedAction: 'update',
        confidence: 1,
        matchedReference: '42',
        reason: 'import.matchExternalKey',
      }),
    ]);
    expect(genericService.findAndCount).not.toHaveBeenCalled();
  });

  it('uses an exact unique value match as a high-confidence update', async () => {
    const row = { rowNumber: 2, rawData: { Name: 'Sapling' } };
    const genericService = {
      findAndCount: jest.fn<
        (
          entityHandle: string,
          filter: unknown,
          page: number,
          limit: number,
          orderBy: unknown,
          user: unknown,
          relations: string[],
        ) => Promise<{ data: object[]; meta: { total: number } }>
      >(() =>
        Promise.resolve({
          data: [{ handle: 7, name: 'Sapling' }],
          meta: { total: 1 },
        }),
      ),
    };
    const service = new ImportMatchingService(
      { find: jest.fn(() => Promise.resolve([row])) } as never,
      genericService as never,
      { getEntityTemplate: () => template } as never,
    );

    const result = await service.matchBatch(
      {
        handle: 11,
        headers: ['Name'],
        mapping: { mappings: [{ sourceColumn: 'Name', targetField: 'name' }] },
      } as never,
      { entityHandle: 'company' },
      {} as never,
      async () => null,
    );

    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'company',
      { $or: [{ name: { $ilike: '%Sapling%' } }] },
      1,
      3,
      {},
      {},
      [],
    );
    expect(result.rows[0]).toMatchObject({
      recommendedAction: 'update',
      confidence: 0.95,
      matchedReference: '7',
      reason: 'import.matchSingleValue',
    });
  });
});
