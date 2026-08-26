import { EntityManager } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import {
  hasUsableProviderCredentials,
  resolveProviderKind,
} from './ai-provider.utils';
import {
  extractProviderHandle,
  sanitizeModel,
  sanitizeProvider,
} from './ai-response.utils';
import type {
  AiEmbeddingTarget,
  AiProviderCapability,
  AiSpeechResponseFormat,
  AiSpeechTarget,
} from './ai.types';

@Injectable()
export class AiProviderRegistryService {
  constructor(private readonly em: EntityManager) {}

  async listActiveProviders(
    capability: AiProviderCapability = 'chat',
    configuredOnly = false,
  ): Promise<AiProviderTypeItem[]> {
    const activeModels = await this.listActiveModels(
      undefined,
      capability,
      configuredOnly,
    );
    const providerHandles = new Set(
      activeModels
        .map((model) => extractProviderHandle(model.provider))
        .filter((handle): handle is string => !!handle),
    );

    if (providerHandles.size === 0) {
      return [];
    }

    const providers = await this.em.find(
      AiProviderTypeItem,
      {
        isActive: true,
        handle: { $in: [...providerHandles] },
      },
      {
        orderBy: {
          title: 'ASC',
        },
      },
    );

    return providers.map((provider) => sanitizeProvider(provider));
  }

  async listActiveModels(
    providerHandle?: string,
    capability: AiProviderCapability = 'chat',
    configuredOnly = false,
  ): Promise<AiProviderModelItem[]> {
    const models = await this.em.find(
      AiProviderModelItem,
      {
        isActive: true,
        ...this.buildModelCapabilityFilter(capability),
        ...(providerHandle?.trim()
          ? { provider: { handle: providerHandle.trim() } }
          : {}),
      },
      {
        populate: ['provider'],
        orderBy: {
          provider: { title: 'ASC' },
          isDefault: 'DESC',
          sortOrder: 'ASC',
          title: 'ASC',
        },
      },
    );

    const modelsWithUsableHandles = models.filter(
      (model) =>
        typeof model.handle === 'string' && model.handle.trim().length > 0,
    );
    const visibleModels = configuredOnly
      ? modelsWithUsableHandles.filter(
          (model) =>
            typeof model.provider !== 'string' &&
            hasUsableProviderCredentials(model.provider),
        )
      : modelsWithUsableHandles;

    return visibleModels.map((model) => sanitizeModel(model));
  }

  async resolveRuntimeTarget(
    preferredProviderHandle?: string | null,
    preferredModelHandle?: string | null,
  ): Promise<AiEmbeddingTarget> {
    return this.resolveAiTarget(
      preferredProviderHandle,
      preferredModelHandle,
      'chat',
    );
  }

  async resolveEmbeddingTarget(
    preferredProviderHandle?: string | null,
    preferredModelHandle?: string | null,
  ): Promise<AiEmbeddingTarget> {
    return this.resolveAiTarget(
      preferredProviderHandle,
      preferredModelHandle,
      'embedding',
    );
  }

  async resolveTranscriptionTarget(
    preferredProviderHandle?: string | null,
    preferredModelHandle?: string | null,
  ): Promise<AiEmbeddingTarget> {
    return this.resolveAiTarget(
      preferredProviderHandle,
      preferredModelHandle,
      'transcription',
    );
  }

  async resolveSpeechTarget(
    preferredProviderHandle?: string | null,
    preferredModelHandle?: string | null,
  ): Promise<AiSpeechTarget> {
    const target = await this.resolveAiTarget(
      preferredProviderHandle,
      preferredModelHandle,
      'speech',
    );

    if (target.providerKind !== 'openai') {
      throw new Error('ai.speechProviderUnsupported');
    }

    return {
      ...target,
      voice: target.model.speechVoice?.trim() || 'nova',
      speed:
        Number.isFinite(target.model.speechSpeed) &&
        target.model.speechSpeed > 0
          ? target.model.speechSpeed
          : 1,
      mimeType: target.model.speechMimeType?.trim() || 'audio/mpeg',
      fileExtension: this.resolveSpeechResponseFormat(
        target.model.speechFileExtension,
      ),
      maxInputLength:
        Number.isFinite(target.model.speechMaxInputLength) &&
        target.model.speechMaxInputLength > 0
          ? Math.floor(target.model.speechMaxInputLength)
          : 4000,
    };
  }

  async resolveWebSearchTarget(
    preferredProviderHandle?: string | null,
    preferredModelHandle?: string | null,
  ): Promise<AiEmbeddingTarget> {
    const target = await this.resolveAiTarget(
      preferredProviderHandle,
      preferredModelHandle,
      'webSearch',
    );

    if (target.providerKind === 'openaiCompatible') {
      throw new Error('ai.webSearchProviderUnsupported');
    }

    return target;
  }

  async hasConfiguredWebSearchTarget(
    preferredProviderHandle?: string | null,
    preferredModelHandle?: string | null,
  ): Promise<boolean> {
    try {
      await this.resolveWebSearchTarget(
        preferredProviderHandle,
        preferredModelHandle,
      );
      return true;
    } catch {
      return false;
    }
  }

  private async resolveAiTarget(
    preferredProviderHandle: string | null | undefined,
    preferredModelHandle: string | null | undefined,
    capability: AiProviderCapability,
  ): Promise<AiEmbeddingTarget> {
    const model = preferredModelHandle?.trim()
      ? await this.findModelByHandle(preferredModelHandle.trim(), capability)
      : preferredProviderHandle?.trim()
        ? await this.findDefaultModelForProvider(
            preferredProviderHandle.trim(),
            capability,
          )
        : await this.getDefaultModelConfig(capability);

    if (!model) {
      throw new NotFoundException(
        capability === 'embedding'
          ? 'ai.embeddingModelNotFound'
          : capability === 'transcription'
            ? 'ai.transcriptionModelNotFound'
            : capability === 'speech'
              ? 'ai.speechModelNotFound'
              : capability === 'webSearch'
                ? 'ai.webSearchModelNotFound'
                : 'ai.modelNotFound',
      );
    }

    await this.em.populate(model, ['provider']);
    const provider = model.provider;

    if (!hasUsableProviderCredentials(provider)) {
      throw new Error(
        capability === 'embedding'
          ? 'ai.embeddingProviderNotConfigured'
          : capability === 'transcription'
            ? 'ai.transcriptionProviderNotConfigured'
            : capability === 'speech'
              ? 'ai.speechProviderNotConfigured'
              : capability === 'webSearch'
                ? 'ai.webSearchProviderNotConfigured'
                : 'ai.providerNotConfigured',
      );
    }

    return {
      provider,
      model,
      providerKind: resolveProviderKind(provider.handle),
    };
  }

  private buildModelCapabilityFilter(
    capability: AiProviderCapability,
  ): Record<string, boolean> {
    switch (capability) {
      case 'embedding':
        return { supportsEmbeddings: true };
      case 'transcription':
        return { supportsTranscription: true };
      case 'speech':
        return { supportsSpeech: true };
      case 'webSearch':
        return { supportsWebSearch: true };
      case 'chat':
      default:
        return { supportsStreaming: true };
    }
  }

  private resolveSpeechResponseFormat(
    fileExtension?: string | null,
  ): AiSpeechResponseFormat {
    switch (fileExtension?.trim().toLowerCase()) {
      case 'wav':
      case 'flac':
      case 'opus':
      case 'pcm':
        return fileExtension.trim().toLowerCase() as AiSpeechResponseFormat;
      case 'mp3':
      default:
        return 'mp3';
    }
  }

  private async getDefaultModelConfig(
    capability: AiProviderCapability = 'chat',
  ): Promise<AiProviderModelItem | null> {
    const models = await this.em.find(
      AiProviderModelItem,
      {
        isActive: true,
        ...this.buildModelCapabilityFilter(capability),
      },
      {
        populate: ['provider'],
        orderBy:
          capability === 'webSearch'
            ? {
                isDefaultWebSearch: 'DESC',
                isDefault: 'DESC',
                sortOrder: 'ASC',
                title: 'ASC',
              }
            : {
                isDefault: 'DESC',
                sortOrder: 'ASC',
                title: 'ASC',
              },
      },
    );

    return (
      models.find((model) =>
        hasUsableProviderCredentials(model.provider as AiProviderTypeItem),
      ) ?? null
    );
  }

  private async findDefaultModelForProvider(
    providerHandle: string,
    capability: AiProviderCapability = 'chat',
  ): Promise<AiProviderModelItem | null> {
    const models = await this.em.find(
      AiProviderModelItem,
      {
        isActive: true,
        ...this.buildModelCapabilityFilter(capability),
        provider: { handle: providerHandle },
      },
      {
        populate: ['provider'],
        orderBy:
          capability === 'webSearch'
            ? {
                isDefaultWebSearch: 'DESC',
                isDefault: 'DESC',
                sortOrder: 'ASC',
                title: 'ASC',
              }
            : {
                isDefault: 'DESC',
                sortOrder: 'ASC',
                title: 'ASC',
              },
        limit: 1,
      },
    );

    return models[0] ?? null;
  }

  private async findModelByHandle(
    handle: string,
    capability: AiProviderCapability = 'chat',
  ): Promise<AiProviderModelItem | null> {
    return this.em.findOne(
      AiProviderModelItem,
      {
        handle,
        isActive: true,
        ...this.buildModelCapabilityFilter(capability),
      },
      { populate: ['provider'] },
    );
  }
}
