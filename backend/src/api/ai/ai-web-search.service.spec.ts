import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import type { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import { AiWebSearchService } from './ai-web-search.service';

describe('AiWebSearchService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses Gemini search and URL context while preserving citations', async () => {
    const provider = {
      handle: 'gemini',
      credentials: { geminiApiKey: 'test-key' },
    } as unknown as AiProviderTypeItem;
    const model = {
      handle: 'gemini-3_5-flash',
      providerModel: 'gemini-3.5-flash',
    } as AiProviderModelItem;
    const resolvedTarget = {
      provider,
      model,
      providerKind: 'gemini' as const,
    };
    const providerRegistry = {
      resolveWebSearchTarget: jest
        .fn<(...args: unknown[]) => Promise<typeof resolvedTarget>>()
        .mockResolvedValue(resolvedTarget),
      hasConfiguredWebSearchTarget: jest.fn(async () => true),
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          steps: [
            {
              type: 'google_search_call',
              arguments: { queries: ['NPAL GmbH Impressum'] },
            },
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: 'Die Firma nennt ihren Sitz in Berlin.',
                  annotations: [
                    {
                      type: 'url_citation',
                      title: 'NPAL Impressum',
                      url: 'https://example.com/impressum',
                    },
                  ],
                },
              ],
            },
          ],
          usage: { total_tokens: 123 },
        }),
        { status: 200 },
      ),
    );
    const service = new AiWebSearchService(providerRegistry as never);

    const result = await service.search({
      query: 'Prüfe die Firma NPAL.',
      urls: ['https://example.com/impressum'],
      preferredProviderHandle: 'gemini',
      preferredModelHandle: 'gemini-3_5-flash',
    });

    expect(result.answer).toContain('Berlin');
    expect(result.queries).toEqual(['NPAL GmbH Impressum']);
    expect(result.sources).toEqual([
      {
        title: 'NPAL Impressum',
        url: 'https://example.com/impressum',
      },
    ]);
    expect(result.providerHandle).toBe('gemini');
    expect(providerRegistry.resolveWebSearchTarget).toHaveBeenCalledWith(
      'gemini',
      'gemini-3_5-flash',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('url_context'),
      }),
    );
  });

  it('does not advertise search when no configured target exists', async () => {
    const providerRegistry = {
      hasConfiguredWebSearchTarget: jest.fn(async () => false),
    };
    const service = new AiWebSearchService(providerRegistry as never);

    await expect(service.isConfigured()).resolves.toBe(false);
  });
});
