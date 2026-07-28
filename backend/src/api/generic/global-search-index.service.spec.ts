import { GlobalSearchIndexService } from './global-search-index.service';
import { GlobalSearchIndexItem } from '../../entity/GlobalSearchIndexItem';

describe('GlobalSearchIndexService', () => {
  it('runs one background rebuild in an isolated request context', async () => {
    const fork = jest.fn().mockReturnValue({});
    const service = new GlobalSearchIndexService(
      { name: 'default', fork } as never,
      {} as never,
      {} as never,
    );
    const rebuildAll = jest
      .spyOn(service, 'rebuildAll')
      .mockImplementation(async (onProgress) => {
        onProgress?.({
          entityHandle: 'company',
          processed: 2,
          entityProcessed: 2,
          total: 2,
        });
        return { processed: 2, entities: 1, indexedItems: 4 };
      });

    expect(service.startRebuild()).toEqual(
      expect.objectContaining({ state: 'running' }),
    );
    expect(service.startRebuild()).toEqual(
      expect.objectContaining({ state: 'running' }),
    );

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(fork).toHaveBeenCalledWith({ useContext: true });
    expect(rebuildAll).toHaveBeenCalledTimes(1);
    expect(service.getRebuildStatus()).toEqual(
      expect.objectContaining({
        state: 'completed',
        processedRecords: 2,
        indexedEntities: 1,
        indexedItems: 4,
        error: null,
      }),
    );
  });

  it('makes background rebuild failures visible through the status', async () => {
    const service = new GlobalSearchIndexService(
      {
        name: 'default',
        fork: jest.fn().mockReturnValue({}),
      } as never,
      {} as never,
      {} as never,
    );
    jest
      .spyOn(service, 'rebuildAll')
      .mockRejectedValue(new Error('database unavailable'));

    service.startRebuild();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(service.getRebuildStatus()).toEqual(
      expect.objectContaining({
        state: 'failed',
        error: 'Error: database unavailable',
        completedAt: expect.any(String),
        durationMs: expect.any(Number),
      }),
    );
  });

  it('does not recursively index the search-index entity itself', async () => {
    const em = {
      findOne: jest.fn(),
      transactional: jest.fn(),
    };
    const templateService = {
      getEntityTemplate: jest.fn(),
    };
    const customFields = {
      appendCustomFieldTemplates: jest.fn(),
      hydrateRecords: jest.fn(),
    };
    const service = new GlobalSearchIndexService(
      em as never,
      templateService as never,
      customFields as never,
    );

    await service.reindexRecord('globalSearchIndex', 1);

    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.transactional).not.toHaveBeenCalled();
    expect(templateService.getEntityTemplate).not.toHaveBeenCalled();
    expect(customFields.hydrateRecords).not.toHaveBeenCalled();
  });

  it('queries only authorized entity and field scopes', async () => {
    const find = jest.fn().mockResolvedValue([
      Object.assign(new GlobalSearchIndexItem(), {
        entityHandle: 'company',
        recordHandle: '12',
        fieldPath: 'name',
        fieldValue: 'Standardfirma GmbH',
        normalizedValue: 'standardfirma gmbh',
      }),
    ]);
    const service = new GlobalSearchIndexService(
      { find } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.findCandidates(
        [{ entityHandle: 'company', fieldPaths: ['name'] }],
        'Standard',
        20,
      ),
    ).resolves.toEqual([
      {
        entityHandle: 'company',
        recordHandle: '12',
        fieldPath: 'name',
        fieldValue: 'Standardfirma GmbH',
      },
    ]);
    expect(find).toHaveBeenCalledWith(
      GlobalSearchIndexItem,
      {
        $and: [
          {
            $or: [
              {
                entityHandle: 'company',
                fieldPath: { $in: ['name'] },
              },
            ],
          },
          { normalizedValue: { $ilike: '%standard%' } },
        ],
      },
      {
        limit: 20,
        orderBy: { sourceUpdatedAt: 'DESC' },
      },
    );
  });

  it('indexes searchable scalar and value-reference fields only', async () => {
    const persisted: Array<Record<string, unknown>> = [];
    const transaction = {
      nativeDelete: jest.fn().mockResolvedValue(1),
      create: jest.fn(
        (_entity: unknown, data: Record<string, unknown>) => data,
      ),
      persist: jest.fn((entries: Array<Record<string, unknown>>) => {
        persisted.push(...entries);
        return { flush: jest.fn().mockResolvedValue(undefined) };
      }),
    };
    const em = {
      findOne: jest.fn().mockResolvedValue({
        handle: 12,
        title: 'Visible ticket',
        secret: 'hidden',
        internalState: 'hidden',
        company: { name: 'Standardfirma GmbH' },
        updatedAt: new Date(),
      }),
      transactional: jest.fn(
        (operation: (tx: typeof transaction) => Promise<void>) =>
          operation(transaction),
      ),
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
                name: 'title',
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
              {
                name: 'internalState',
                type: 'string',
                isPersistent: true,
                isReference: false,
                options: ['isSystem'],
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
    const customFields = {
      appendCustomFieldTemplates: jest.fn(
        (_entityHandle: string, template: unknown[]) =>
          Promise.resolve(template),
      ),
      hydrateRecords: jest.fn(
        (_entityHandle: string, record: Record<string, unknown>) =>
          Promise.resolve(record),
      ),
    };
    const service = new GlobalSearchIndexService(
      em as never,
      templateService as never,
      customFields as never,
    );

    await service.reindexRecord('ticket', 12);

    expect(em.findOne).toHaveBeenCalledWith(
      expect.any(Function),
      { handle: 12 },
      { populate: ['company'] },
    );
    expect(persisted.map((entry) => entry.fieldPath)).toEqual([
      'title',
      'company.name',
    ]);
  });
});
