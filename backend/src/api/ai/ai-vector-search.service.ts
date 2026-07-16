import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { GenericService } from '../generic/generic.service';
import { FieldPermissionService } from '../current/field-permission.service';
import { AiVectorIndexRow } from './ai.types';
import { extractRecordHandle } from './ai-navigation.utils';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiVectorEmbeddingService } from './ai-vector-embedding.service';
import {
  assertVectorizableEntity,
  asSimilarityScore,
  buildVectorExcerpt,
  coerceVectorRecordHandle,
  getVectorSearchRelations,
  getVectorSectionFieldPaths,
  getVectorSearchUsageHints,
  getVectorSearchableSections,
  resolveVectorSearchCandidateMultiplier,
  resolveVectorSearchMaxCandidateLimit,
  resolveVectorSearchMaxResults,
  toVectorLiteral,
} from './ai-vector.utils';

type VectorSearchRow = {
  source_record_handle: string;
  source_section: string;
  chunk_index: number;
  title: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number | string;
};

type VectorSearchMatch = {
  score: number;
  section: string;
  chunkIndex: number;
  title: string | null;
  excerpt: string;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class AiVectorSearchService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericService: GenericService,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly embeddingService: AiVectorEmbeddingService,
    private readonly fieldPermissions: FieldPermissionService = {
      assertReadableFields: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  async searchVectorDocuments(
    entityHandle: string,
    query: string,
    user: PersonItem,
    limit = 5,
  ): Promise<Record<string, unknown>> {
    const normalizedEntityHandle = entityHandle.trim();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('ai.vectorSearchQueryMissing');
    }

    assertVectorizableEntity(normalizedEntityHandle);
    const index = await this.getVectorIndex(normalizedEntityHandle);

    if (!index) {
      return {
        entityHandle: normalizedEntityHandle,
        query: normalizedQuery,
        indexed: false,
        results: [],
        usageHints: [
          'Ask an administrator to run vectorization for this entity before using semantic search.',
        ],
      };
    }

    const embeddingTarget = await this.providerRegistry.resolveEmbeddingTarget(
      index.provider_handle,
      index.model_handle,
    );
    const readableSections = await this.getReadableSections(
      normalizedEntityHandle,
      user,
    );
    if (readableSections.length === 0) {
      return {
        entityHandle: normalizedEntityHandle,
        query: normalizedQuery,
        indexed: true,
        providerHandle: embeddingTarget.provider.handle,
        modelHandle: embeddingTarget.model.handle,
        indexedDocumentCount: Number(index.document_count) || 0,
        searchableSections: [],
        results: [],
        usageHints: getVectorSearchUsageHints(normalizedEntityHandle),
      };
    }
    const [queryEmbedding] = await this.embeddingService.embedTexts(
      [normalizedQuery],
      embeddingTarget,
      'query',
    );
    const candidateLimit = Math.min(
      Math.max(limit, 1) *
        resolveVectorSearchCandidateMultiplier(embeddingTarget.model),
      resolveVectorSearchMaxCandidateLimit(embeddingTarget.model),
    );
    const vectorLiteral = toVectorLiteral(queryEmbedding ?? []);
    const rows = (await this.em.getConnection().execute(
      `select "source_record_handle", "source_section", "chunk_index", "title", "content", "metadata",
              1 - ("embedding" <=> ?::vector) as "similarity"
       from "ai_vector_document_item"
       where "source_entity_handle" = ?
         and "source_section" in (${readableSections.map(() => '?').join(', ')})
       order by "embedding" <=> ?::vector asc
       limit ?`,
      [
        vectorLiteral,
        normalizedEntityHandle,
        ...readableSections,
        vectorLiteral,
        candidateLimit,
      ],
    )) as VectorSearchRow[];

    const groupedRows = new Map<
      string,
      { score: number; matches: VectorSearchMatch[] }
    >();

    for (const row of rows) {
      const key = row.source_record_handle;
      const similarity = asSimilarityScore(row.similarity);
      const match = {
        score: similarity,
        section: row.source_section,
        chunkIndex: row.chunk_index,
        title: row.title,
        excerpt: buildVectorExcerpt(row.content),
        metadata: row.metadata ?? null,
      };
      const existingGroup = groupedRows.get(key);

      if (existingGroup) {
        existingGroup.score = Math.max(existingGroup.score, similarity);
        existingGroup.matches.push(match);
        continue;
      }

      groupedRows.set(key, {
        score: similarity,
        matches: [match],
      });
    }

    const accessibleRecords = await this.loadVectorSearchRecords(
      normalizedEntityHandle,
      [...groupedRows.keys()],
      user,
    );
    const results = accessibleRecords
      .map((record) => {
        const recordHandle = extractRecordHandle(record);

        if (recordHandle == null) {
          return null;
        }

        const recordHandleKey = String(recordHandle);
        const groupedResult = groupedRows.get(recordHandleKey);

        if (!groupedResult) {
          return null;
        }

        return {
          handle: coerceVectorRecordHandle(recordHandleKey),
          score: groupedResult.score,
          record,
          matches: groupedResult.matches
            .sort((left, right) => right.score - left.score)
            .slice(0, 3),
        };
      })
      .filter(
        (
          result,
        ): result is {
          handle: string | number;
          score: number;
          record: object;
          matches: VectorSearchMatch[];
        } => result != null,
      )
      .sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0))
      .slice(
        0,
        Math.min(
          Math.max(limit, 1),
          resolveVectorSearchMaxResults(embeddingTarget.model),
        ),
      );

    return {
      entityHandle: normalizedEntityHandle,
      query: normalizedQuery,
      indexed: true,
      providerHandle: embeddingTarget.provider.handle,
      modelHandle: embeddingTarget.model.handle,
      indexedDocumentCount: Number(index.document_count) || 0,
      searchableSections: readableSections,
      results,
      usageHints: getVectorSearchUsageHints(normalizedEntityHandle),
    };
  }

  private async getReadableSections(
    entityHandle: string,
    user: PersonItem,
  ): Promise<string[]> {
    const readable: string[] = [];
    for (const section of getVectorSearchableSections(entityHandle)) {
      try {
        await this.fieldPermissions.assertReadableFields(
          user,
          entityHandle,
          getVectorSectionFieldPaths(entityHandle, section),
        );
        readable.push(section);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
        // A section is excluded before ranking if any source field is hidden.
      }
    }
    return readable;
  }

  private async getVectorIndex(
    entityHandle: string,
  ): Promise<AiVectorIndexRow | null> {
    const rows = (await this.em.getConnection().execute(
      `select "provider_handle", "model_handle", count(*) as "document_count"
       from "ai_vector_document_item"
       where "source_entity_handle" = ?
       group by "provider_handle", "model_handle"
       order by max("updated_at") desc
       limit 1`,
      [entityHandle],
    )) as AiVectorIndexRow[];

    return rows[0] ?? null;
  }

  private async loadVectorSearchRecords(
    entityHandle: string,
    recordHandles: string[],
    user: PersonItem,
  ): Promise<object[]> {
    if (recordHandles.length === 0) {
      return [];
    }

    const result = await this.genericService.findAndCount(
      entityHandle,
      {
        handle: {
          $in: recordHandles.map((handle) => coerceVectorRecordHandle(handle)),
        },
      },
      1,
      recordHandles.length,
      {},
      user,
      getVectorSearchRelations(entityHandle),
    );

    return result.data;
  }
}
