import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { AiVectorDocumentRow } from './ai.types';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiVectorDocumentBuilderService } from './ai-vector-document-builder.service';
import { AiVectorEmbeddingService } from './ai-vector-embedding.service';
import { buildVectorDocumentKey, toVectorLiteral } from './ai-vector.utils';
import {
  VectorizeEntityDto,
  VectorizeEntityResponseDto,
} from './dto/vectorization.dto';

@Injectable()
export class AiVectorIndexService {
  constructor(
    private readonly em: EntityManager,
    private readonly providerRegistry: AiProviderRegistryService,
    private readonly documentBuilder: AiVectorDocumentBuilderService,
    private readonly embeddingService: AiVectorEmbeddingService,
  ) {}

  async vectorizeEntity(
    dto: VectorizeEntityDto,
  ): Promise<VectorizeEntityResponseDto> {
    const entityHandle = dto.entityHandle.trim();
    const embeddingTarget = await this.providerRegistry.resolveEmbeddingTarget(
      dto.providerHandle,
      dto.modelHandle,
    );
    const documents = await this.documentBuilder.buildVectorDocuments(
      entityHandle,
      embeddingTarget.model,
    );
    const connection = this.em.getConnection();
    const existingRows = (await connection.execute(
      `select "handle", "source_record_handle", "source_section", "chunk_index", "title", "content", "content_hash", "metadata", "provider_handle", "model_handle", "embedding_dimensions"
       from "ai_vector_document_item"
       where "source_entity_handle" = ?`,
      [entityHandle],
    )) as AiVectorDocumentRow[];

    const existingByKey = new Map(
      existingRows.map((row) => [buildVectorDocumentKey(row), row]),
    );
    const nextKeys = new Set(
      documents.map((document) => buildVectorDocumentKey(document)),
    );
    const documentsToDelete = existingRows.filter(
      (row) => !nextKeys.has(buildVectorDocumentKey(row)),
    );
    const documentsToEmbed = documents.filter((document) => {
      const existingRow = existingByKey.get(buildVectorDocumentKey(document));

      if (!existingRow) {
        return true;
      }

      return (
        existingRow.content_hash !== document.contentHash ||
        existingRow.provider_handle !== embeddingTarget.provider.handle ||
        existingRow.model_handle !== embeddingTarget.model.handle
      );
    });
    const embeddings = await this.embeddingService.embedTexts(
      documentsToEmbed.map((document) => document.content),
      embeddingTarget,
      'document',
    );

    await this.em.transactional(async (transactionalEm) => {
      const transactionalConnection = transactionalEm.getConnection();

      for (const row of documentsToDelete) {
        await transactionalConnection.execute(
          `delete from "ai_vector_document_item" where "handle" = ?`,
          [row.handle],
        );
      }

      for (const [index, document] of documentsToEmbed.entries()) {
        const existingRow = existingByKey.get(buildVectorDocumentKey(document));
        const embedding = embeddings[index] ?? [];
        const vectorLiteral = toVectorLiteral(embedding);
        const metadata = document.metadata
          ? JSON.stringify(document.metadata)
          : null;

        if (existingRow) {
          await transactionalConnection.execute(
            `update "ai_vector_document_item"
             set "title" = ?, "content" = ?, "content_hash" = ?, "metadata" = ?::jsonb, "provider_handle" = ?, "model_handle" = ?, "embedding_dimensions" = ?, "embedding" = ?::vector, "updated_at" = now()
             where "handle" = ?`,
            [
              document.title,
              document.content,
              document.contentHash,
              metadata,
              embeddingTarget.provider.handle,
              embeddingTarget.model.handle,
              embedding.length,
              vectorLiteral,
              existingRow.handle,
            ],
          );
          continue;
        }

        await transactionalConnection.execute(
          `insert into "ai_vector_document_item"
           ("source_entity_handle", "source_record_handle", "source_section", "chunk_index", "title", "content", "content_hash", "metadata", "provider_handle", "model_handle", "embedding_dimensions", "embedding", "created_at", "updated_at")
           values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?::vector, now(), now())`,
          [
            entityHandle,
            document.sourceRecordHandle,
            document.sourceSection,
            document.chunkIndex,
            document.title,
            document.content,
            document.contentHash,
            metadata,
            embeddingTarget.provider.handle,
            embeddingTarget.model.handle,
            embedding.length,
            vectorLiteral,
          ],
        );
      }
    });

    const response = new VectorizeEntityResponseDto();
    response.entityHandle = entityHandle;
    response.providerHandle = embeddingTarget.provider.handle;
    response.modelHandle = embeddingTarget.model.handle;
    response.totalSourceRecords = new Set(
      documents.map((document) => document.sourceRecordHandle),
    ).size;
    response.totalDocuments = documents.length;
    response.embeddedDocuments = documentsToEmbed.length;
    response.skippedDocuments = documents.length - documentsToEmbed.length;
    response.deletedDocuments = documentsToDelete.length;
    return response;
  }
}
