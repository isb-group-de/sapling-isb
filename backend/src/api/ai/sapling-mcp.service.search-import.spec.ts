import { describe, expect, it, jest } from '@jest/globals';
import { createService } from './sapling-mcp.service.spec-support';

describe('SaplingMcpService search and import tools', () => {
  it('searches TicketItem problem and solution fields via ticket_search', async () => {
    const genericService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getRecordTimeline: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue({
        data: [{ handle: 42, title: 'Sage 100 Fehler' }],
        meta: { total: 1 },
      } as never),
    };
    const currentService = { getPerson: jest.fn() };
    const templateService = {
      getEntityTemplate: jest.fn().mockReturnValue([]),
    };
    const service = createService({
      genericService,
      currentService,
      templateService,
    });
    const user = { handle: 1 } as never;

    const result = await service.executeTool(
      'ticket_search',
      {
        query: 'Sage 100',
        searchMode: 'solution',
        limit: 5,
      },
      user,
    );

    expect(genericService.findAndCount).toHaveBeenCalledWith(
      'ticket',
      {
        $or: [
          { number: { $ilike: '%Sage 100%' } },
          { externalNumber: { $ilike: '%Sage 100%' } },
          { title: { $ilike: '%Sage 100%' } },
          { solutionDescription: { $ilike: '%Sage 100%' } },
        ],
      },
      1,
      5,
      {},
      user,
      [],
    );
    expect(result.rawResult).toMatchObject({
      entityHandle: 'ticket',
      query: 'Sage 100',
      searchMode: 'solution',
      data: [{ handle: 42, title: 'Sage 100 Fehler' }],
    });
    expect(result.modelResult).toMatchObject({
      entityHandle: 'ticket',
      data: [
        {
          handle: 42,
          displayValue: 'Sage 100 Fehler',
          title: 'Sage 100 Fehler',
        },
      ],
    });
  });

  it('forwards semantic_search to AiService with normalized limits', async () => {
    const aiService = {
      searchVectorDocuments: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({
          entityHandle: 'effortEstimate',
          indexed: true,
          results: [],
        }),
    };
    const service = createService({ aiService });
    const user = { handle: 1 } as never;

    const result = await service.executeTool(
      'semantic_search',
      {
        entityHandle: 'effortEstimate',
        query: 'Anforderungen fuer Portal-Synchronisation',
        limit: 99,
      },
      user,
    );

    expect(aiService.searchVectorDocuments).toHaveBeenCalledWith(
      'effortEstimate',
      'Anforderungen fuer Portal-Synchronisation',
      user,
      20,
    );
    expect(result.rawResult).toMatchObject({
      entityHandle: 'effortEstimate',
      indexed: true,
      results: [],
    });
  });

  it('combines readable sources for knowledge_search', async () => {
    const aiService = {
      searchVectorDocuments: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation((entityHandle: unknown) =>
          Promise.resolve({
            entityHandle,
            indexed: true,
            results: [
              {
                handle: entityHandle === 'knowledgeArticle' ? 7 : 42,
                score: entityHandle === 'knowledgeArticle' ? 0.91 : 0.82,
                record: { title: `${String(entityHandle)} Treffer` },
                matches: [],
              },
            ],
          }),
        ),
    };
    const permissionService = {
      assertEntityPermission: jest
        .fn<(...args: unknown[]) => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    const service = createService({ aiService, permissionService });
    const user = { handle: 1 } as never;

    const result = await service.executeTool(
      'knowledge_search',
      {
        query: 'Sage startet nach Update nicht',
        entityHandles: ['knowledgeArticle', 'ticket'],
        limit: 5,
      },
      user,
    );

    expect(permissionService.assertEntityPermission).toHaveBeenCalledWith(
      user,
      'knowledgeArticle',
      'allowRead',
    );
    expect(aiService.searchVectorDocuments).toHaveBeenCalledWith(
      'knowledgeArticle',
      'Sage startet nach Update nicht',
      user,
      5,
    );
    expect(aiService.searchVectorDocuments).toHaveBeenCalledWith(
      'ticket',
      'Sage startet nach Update nicht',
      user,
      5,
    );
    expect(result.rawResult).toMatchObject({
      query: 'Sage startet nach Update nicht',
      indexedEntityHandles: ['knowledgeArticle', 'ticket'],
      results: [
        {
          entityHandle: 'knowledgeArticle',
          handle: 7,
          score: 0.91,
        },
        {
          entityHandle: 'ticket',
          handle: 42,
          score: 0.82,
        },
      ],
    });
    expect(result.modelResult).toMatchObject({
      results: [
        {
          entityHandle: 'knowledgeArticle',
          handle: 7,
        },
        {
          entityHandle: 'ticket',
          handle: 42,
        },
      ],
    });
  });

  it('normalizes AI import configure payloads and ignores external keys without a source', async () => {
    const currentService = {
      getPerson: jest.fn().mockResolvedValue({
        handle: 1,
        roles: [{ isAdministrator: true }],
      } as never),
    };
    const importService = {
      getBatch: jest.fn().mockResolvedValue({
        handle: 3,
        headers: ['handle', 'title', 'name', 'version', 'description'],
      } as never),
      configureBatch: jest.fn().mockResolvedValue({
        handle: 3,
        status: 'validated',
        entityHandle: 'product',
        readyCount: 2,
      } as never),
    };
    const permissionService = {
      assertEntityPermission: jest.fn().mockResolvedValue(undefined as never),
    };
    const service = createService({
      currentService,
      importService,
      permissionService,
    });
    const user = { handle: 1 } as never;

    await service.executeTool(
      'import_configure_batch',
      {
        batchHandle: 3,
        entityHandle: 'product',
        mappings: {
          name: 'name',
          title: 'title',
          version: 'version',
          description: 'description',
        },
        keyColumns: ['name'],
      },
      user,
    );

    expect(importService.configureBatch).toHaveBeenCalledWith(
      3,
      {
        entityHandle: 'product',
        sourceHandle: null,
        templateHandle: null,
        keyColumns: [],
        mappings: [
          { sourceColumn: 'handle', targetField: 'handle' },
          { sourceColumn: 'name', targetField: 'name' },
          { sourceColumn: 'title', targetField: 'title' },
          { sourceColumn: 'version', targetField: 'version' },
          { sourceColumn: 'description', targetField: 'description' },
        ],
        relationMappings: [],
        valueMappings: [],
        genericReferenceMapping: null,
      },
      user,
    );
  });
});
