import { describe, expect, it } from '@jest/globals';
import { AiAgentRunLifecycleService } from './ai-agent-run-lifecycle.service';

describe('AiAgentRunLifecycleService', () => {
  it('persists deduplicated web citations as first-class sources', () => {
    const service = new AiAgentRunLifecycleService({} as never);

    const sources = service.buildSources(
      [
        {
          serverHandle: 0,
          serverName: 'sapling',
          toolName: 'web_search',
          arguments: { query: 'NPAL' },
          rawResult: {
            providerHandle: 'openai',
            modelHandle: 'openai-gpt-5_6-luna',
            searchedAt: '2026-08-26T10:00:00.000Z',
            sources: [
              {
                title: 'Impressum',
                url: 'https://example.com/impressum',
              },
              {
                title: 'Impressum',
                url: 'https://example.com/impressum',
              },
            ],
          },
        },
      ],
      [],
    );

    expect(sources).toEqual([
      expect.objectContaining({
        kind: 'web',
        title: 'Impressum',
        url: 'https://example.com/impressum',
        providerHandle: 'openai',
      }),
    ]);
  });
});
