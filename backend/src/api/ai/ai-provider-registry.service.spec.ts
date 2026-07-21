import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager } from '@mikro-orm/core';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import type { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import type { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';

describe('AiProviderRegistryService', () => {
  it('omits active models whose technical handle is empty', async () => {
    const provider = {
      handle: 'ollama',
      title: 'Ollama',
      isActive: true,
    } as AiProviderTypeItem;
    const models = [
      {
        handle: '',
        title: 'Broken manual model',
        provider,
        providerModel: 'gemma4:12b',
        isActive: true,
        supportsStreaming: true,
      },
      {
        handle: 'ollama-gemma4-12b',
        title: 'Gemma 4 12B',
        provider,
        providerModel: 'gemma4:12b',
        isActive: true,
        supportsStreaming: true,
      },
    ] as AiProviderModelItem[];
    const em = {
      find: jest.fn(async () => models),
    } as unknown as EntityManager;
    const service = new AiProviderRegistryService(em);

    const result = await service.listActiveModels(undefined, 'chat');

    expect(result.map((model) => model.handle)).toEqual(['ollama-gemma4-12b']);
  });
});
