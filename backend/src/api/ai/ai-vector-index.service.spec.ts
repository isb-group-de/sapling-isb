import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager } from '@mikro-orm/core';
import type {
  AiEmbeddingTarget,
  AiVectorDocumentDraft,
  AiVectorDocumentRow,
} from './ai.types';
import type { AiProviderRegistryService } from './ai-provider-registry.service';
import type { AiVectorDocumentBuilderService } from './ai-vector-document-builder.service';
import { AiVectorIndexService } from './ai-vector-index.service';

const embeddingTarget = {
  provider: { handle: 'provider-a' },
  model: { handle: 'model-a' },
  providerKind: 'openai',
} as unknown as AiEmbeddingTarget;

function draft(
  sourceRecordHandle: string,
  contentHash: string,
): AiVectorDocumentDraft {
  return {
    sourceRecordHandle,
    sourceSection: 'overview',
    chunkIndex: 0,
    title: `Document ${sourceRecordHandle}`,
    content: `Content ${sourceRecordHandle}`,
    contentHash,
    metadata: { sourceRecordHandle },
  };
}

function row(
  handle: number,
  sourceRecordHandle: string,
  contentHash: string,
): AiVectorDocumentRow {
  return {
    handle,
    source_record_handle: sourceRecordHandle,
    source_section: 'overview',
    chunk_index: 0,
    title: `Existing ${sourceRecordHandle}`,
    content: `Existing content ${sourceRecordHandle}`,
    content_hash: contentHash,
    metadata: null,
    provider_handle: 'provider-a',
    model_handle: 'model-a',
    embedding_dimensions: 2,
  };
}

describe('AiVectorIndexService', () => {
  it('embeds only changed documents and deletes obsolete index rows', async () => {
    const documents = [
      draft('1', 'same'),
      draft('2', 'new'),
      draft('3', 'new'),
    ];
    const existingRows = [
      row(11, '1', 'same'),
      row(12, '2', 'old'),
      row(14, '4', 'obsolete'),
    ];
    const readExecute = jest
      .fn<
        (sql: string, parameters?: unknown[]) => Promise<AiVectorDocumentRow[]>
      >()
      .mockResolvedValue(existingRows);
    const writeExecute = jest
      .fn<(sql: string, parameters?: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValue([]);
    const transactional = jest.fn(
      async (callback: (em: { getConnection(): unknown }) => Promise<void>) =>
        callback({ getConnection: () => ({ execute: writeExecute }) }),
    );
    const em = {
      getConnection: () => ({ execute: readExecute }),
      transactional,
    } as unknown as EntityManager;
    const resolveEmbeddingTarget = jest
      .fn<
        (
          providerHandle?: string,
          modelHandle?: string,
        ) => Promise<AiEmbeddingTarget>
      >()
      .mockResolvedValue(embeddingTarget);
    const buildVectorDocuments = jest
      .fn<
        (
          entityHandle: string,
          model: unknown,
        ) => Promise<AiVectorDocumentDraft[]>
      >()
      .mockResolvedValue(documents);
    const embedTexts = jest
      .fn<
        (
          texts: string[],
          target: AiEmbeddingTarget,
          purpose: 'document' | 'query',
        ) => Promise<number[][]>
      >()
      .mockResolvedValue([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
    const service = new AiVectorIndexService(
      em,
      { resolveEmbeddingTarget } as unknown as AiProviderRegistryService,
      { buildVectorDocuments } as unknown as AiVectorDocumentBuilderService,
      { embedTexts },
    );

    const result = await service.vectorizeEntity({
      entityHandle: ' ticket ',
      providerHandle: 'provider-a',
      modelHandle: 'model-a',
    });

    expect(buildVectorDocuments).toHaveBeenCalledWith(
      'ticket',
      embeddingTarget.model,
    );
    const embeddingCall = embedTexts.mock.calls[0] as unknown[];
    expect(embeddingCall[0]).toEqual(['Content 2', 'Content 3']);
    expect(embeddingCall[1]).toBe(embeddingTarget);
    expect(embeddingCall[2]).toBe('document');
    expect(writeExecute).toHaveBeenCalledTimes(3);
    expect(String(writeExecute.mock.calls[0]?.[0])).toContain(
      'delete from "ai_vector_document_item"',
    );
    expect(writeExecute.mock.calls[0]?.[1]).toEqual([14]);
    expect(String(writeExecute.mock.calls[1]?.[0])).toContain(
      'update "ai_vector_document_item"',
    );
    expect(writeExecute.mock.calls[1]?.[1]).toEqual(
      expect.arrayContaining(['new', '[0.1,0.2]', 12]),
    );
    expect(String(writeExecute.mock.calls[2]?.[0])).toContain(
      'insert into "ai_vector_document_item"',
    );
    expect(result).toMatchObject({
      entityHandle: 'ticket',
      providerHandle: 'provider-a',
      modelHandle: 'model-a',
      totalSourceRecords: 3,
      totalDocuments: 3,
      embeddedDocuments: 2,
      skippedDocuments: 1,
      deletedDocuments: 1,
    });
  });
});
