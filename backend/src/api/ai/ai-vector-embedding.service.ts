import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { AiEmbeddingPurpose, AiEmbeddingTarget } from './ai.types';
import { resolveEmbeddingBatchSize } from './ai-vector.utils';
import { embedGeminiTexts } from './gemini-ai.runtime';
import { embedOpenAiTexts } from './openai-ai.runtime';
import { AiUsageTelemetryService } from '../system/services/ai-usage-telemetry.service';

@Injectable()
export class AiVectorEmbeddingService {
  constructor(
    @Optional() private readonly usageTelemetry?: AiUsageTelemetryService,
  ) {}

  async embedTexts(
    texts: string[],
    target: AiEmbeddingTarget,
    purpose: AiEmbeddingPurpose,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const sourceKey = `embedding:${randomUUID()}`;
    const startedAt = performance.now();
    try {
      const embeddings: number[][] = [];
      const batchSize = resolveEmbeddingBatchSize(target.model);

      for (let index = 0; index < texts.length; index += batchSize) {
        const batch = texts.slice(index, index + batchSize);
        const batchEmbeddings =
          target.providerKind === 'gemini'
            ? await embedGeminiTexts({
                provider: target.provider,
                model: target.model.providerModel,
                texts: batch,
                purpose,
              })
            : await embedOpenAiTexts(
                target.provider,
                target.model.providerModel,
                batch,
              );

        embeddings.push(...batchEmbeddings);
      }

      void this.usageTelemetry?.record({
        sourceKey,
        operation: 'embedding',
        executionType: String(purpose),
        provider: target.provider.handle,
        model: target.model.providerModel,
        status: 'completed',
        durationMs: Math.round(performance.now() - startedAt),
      });
      return embeddings;
    } catch (error) {
      void this.usageTelemetry?.record({
        sourceKey,
        operation: 'embedding',
        executionType: String(purpose),
        provider: target.provider.handle,
        model: target.model.providerModel,
        status: 'failed',
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  }
}
