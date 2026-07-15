import { Injectable } from '@nestjs/common';
import { AiEmbeddingPurpose, AiEmbeddingTarget } from './ai.types';
import { resolveEmbeddingBatchSize } from './ai-vector.utils';
import { embedGeminiTexts } from './gemini-ai.runtime';
import { embedOpenAiTexts } from './openai-ai.runtime';

@Injectable()
export class AiVectorEmbeddingService {
  async embedTexts(
    texts: string[],
    target: AiEmbeddingTarget,
    purpose: AiEmbeddingPurpose,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

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

    return embeddings;
  }
}
