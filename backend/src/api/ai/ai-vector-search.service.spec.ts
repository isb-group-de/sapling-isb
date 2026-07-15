import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager } from '@mikro-orm/core';
import type { PersonItem } from '../../entity/PersonItem';
import type { GenericService } from '../generic/generic.service';
import type { AiEmbeddingTarget } from './ai.types';
import type { AiProviderRegistryService } from './ai-provider-registry.service';
import type { AiVectorEmbeddingService } from './ai-vector-embedding.service';
import { AiVectorSearchService } from './ai-vector-search.service';

const embeddingTarget = {
  provider: { handle: 'provider-a' },
  model: { handle: 'model-a' },
  providerKind: 'openai',
} as unknown as AiEmbeddingTarget;

describe('AiVectorSearchService', () => {
  it('reports an unindexed entity without resolving or embedding a provider', async () => {
    const execute = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
    const resolveEmbeddingTarget = jest.fn();
    const embedTexts = jest.fn();
    const providerRegistry = {
      resolveEmbeddingTarget,
    } as unknown as AiProviderRegistryService;
    const embeddingService = {
      embedTexts,
    } as unknown as AiVectorEmbeddingService;
    const service = new AiVectorSearchService(
      { getConnection: () => ({ execute }) } as unknown as EntityManager,
      {} as GenericService,
      providerRegistry,
      embeddingService,
    );

    await expect(
      service.searchVectorDocuments(
        ' ticket ',
        ' printer failure ',
        {} as PersonItem,
      ),
    ).resolves.toMatchObject({
      entityHandle: 'ticket',
      query: 'printer failure',
      indexed: false,
      results: [],
    });
    expect(resolveEmbeddingTarget).not.toHaveBeenCalled();
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it('returns only permission-accessible records with grouped vector matches', async () => {
    const indexRows = [
      {
        provider_handle: 'provider-a',
        model_handle: 'model-a',
        document_count: '3',
      },
    ];
    const searchRows = [
      {
        source_record_handle: '1',
        source_section: 'problem',
        chunk_index: 0,
        title: 'Hidden record',
        content: 'Hidden but highly similar content',
        metadata: null,
        similarity: '0.95',
      },
      {
        source_record_handle: '2',
        source_section: 'solution',
        chunk_index: 1,
        title: 'Visible record',
        content: 'Second-best matching solution',
        metadata: { kind: 'solution' },
        similarity: '0.8',
      },
      {
        source_record_handle: '2',
        source_section: 'overview',
        chunk_index: 0,
        title: 'Visible record',
        content: 'Overview match',
        metadata: null,
        similarity: '0.6',
      },
    ];
    const execute = jest
      .fn<(sql: string) => Promise<unknown[]>>()
      .mockResolvedValueOnce(indexRows)
      .mockResolvedValueOnce(searchRows);
    const user = { handle: 7 } as PersonItem;
    const findAndCount = jest
      .fn<
        (...arguments_: unknown[]) => Promise<{
          data: Array<{ handle: number; title: string }>;
          total: number;
        }>
      >()
      .mockResolvedValue({
        data: [{ handle: 2, title: 'Visible record' }],
        total: 1,
      });
    const genericService = { findAndCount } as unknown as GenericService;
    const resolveEmbeddingTarget = jest
      .fn<() => Promise<AiEmbeddingTarget>>()
      .mockResolvedValue(embeddingTarget);
    const providerRegistry = {
      resolveEmbeddingTarget,
    } as unknown as AiProviderRegistryService;
    const embedTexts = jest
      .fn<() => Promise<number[][]>>()
      .mockResolvedValue([[0.25, 0.5]]);
    const embeddingService = {
      embedTexts,
    } as unknown as AiVectorEmbeddingService;
    const service = new AiVectorSearchService(
      { getConnection: () => ({ execute }) } as unknown as EntityManager,
      genericService,
      providerRegistry,
      embeddingService,
    );

    const result = await service.searchVectorDocuments(
      'ticket',
      'printer failure',
      user,
      5,
    );

    const embeddingCall = embedTexts.mock.calls[0] as unknown[];
    expect(embeddingCall[0]).toEqual(['printer failure']);
    expect(embeddingCall[1]).toBe(embeddingTarget);
    expect(embeddingCall[2]).toBe('query');
    expect(findAndCount).toHaveBeenCalledWith(
      'ticket',
      { handle: { $in: [1, 2] } },
      1,
      2,
      {},
      user,
      expect.arrayContaining(['status', 'priority']),
    );
    expect(result).toMatchObject({
      entityHandle: 'ticket',
      indexed: true,
      providerHandle: 'provider-a',
      modelHandle: 'model-a',
      indexedDocumentCount: 3,
      results: [
        {
          handle: 2,
          score: 0.8,
          record: { handle: 2, title: 'Visible record' },
          matches: [
            { score: 0.8, section: 'solution' },
            { score: 0.6, section: 'overview' },
          ],
        },
      ],
    });
  });
});
