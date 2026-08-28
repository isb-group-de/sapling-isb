import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager } from '@mikro-orm/core';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
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
      find: jest.fn(() => Promise.resolve(models)),
    } as unknown as EntityManager;
    const service = new AiProviderRegistryService(em);

    const result = await service.listActiveModels(undefined, 'chat');

    expect(result.map((model) => model.handle)).toEqual(['ollama-gemma4-12b']);
  });

  it('filters for web-search-capable models', async () => {
    const provider = {
      handle: 'gemini',
      title: 'Gemini',
      credentials: { geminiApiKey: 'test-key' },
      isActive: true,
    } as unknown as AiProviderTypeItem;
    const models = [
      {
        handle: 'gemini-3_5-flash',
        title: 'Gemini 3.5 Flash',
        provider,
        providerModel: 'gemini-3.5-flash',
        isActive: true,
        supportsWebSearch: true,
      },
    ] as AiProviderModelItem[];
    const find = jest
      .fn<(...args: unknown[]) => Promise<AiProviderModelItem[]>>()
      .mockResolvedValue(models);
    const service = new AiProviderRegistryService({ find } as never);

    const result = await service.listActiveModels(undefined, 'webSearch');

    expect(result).toHaveLength(1);
    expect(find).toHaveBeenCalledWith(
      AiProviderModelItem,
      expect.objectContaining({ supportsWebSearch: true }),
      expect.any(Object),
    );
  });

  it('uses the selected provider default when no web-search model is selected', async () => {
    const provider = {
      handle: 'gemini',
      title: 'Gemini',
      credentials: { geminiApiKey: 'test-key' },
      isActive: true,
    } as unknown as AiProviderTypeItem;
    const model = {
      handle: 'gemini-3_5-flash',
      title: 'Gemini 3.5 Flash',
      provider,
      providerModel: 'gemini-3.5-flash',
      isActive: true,
      supportsWebSearch: true,
    } as AiProviderModelItem;
    const find = jest
      .fn<(...args: unknown[]) => Promise<AiProviderModelItem[]>>()
      .mockResolvedValue([model]);
    const populate = jest.fn(() => Promise.resolve());
    const service = new AiProviderRegistryService({ find, populate } as never);

    const result = await service.resolveWebSearchTarget('gemini', null);

    expect(result).toMatchObject({
      provider: { handle: 'gemini' },
      model: { handle: 'gemini-3_5-flash' },
      providerKind: 'gemini',
    });
    expect(find).toHaveBeenCalledWith(
      AiProviderModelItem,
      expect.objectContaining({
        supportsWebSearch: true,
        provider: { handle: 'gemini' },
      }),
      expect.any(Object),
    );
  });
});
