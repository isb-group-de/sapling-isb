import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@google/generative-ai', () => ({
  SchemaType: {
    ARRAY: 'array',
    BOOLEAN: 'boolean',
    INTEGER: 'integer',
    NUMBER: 'number',
    OBJECT: 'object',
    STRING: 'string',
  },
}));
jest.mock('./gemini-ai.runtime', () => ({
  createGeminiClient: jest.fn(),
  createGeminiStreamingClient: jest.fn(),
}));
jest.mock('./openai-ai.runtime', () => ({ createOpenAiClient: jest.fn() }));
jest.mock('./mcp.service', () => ({ McpService: class {} }));

import { AiChatRuntimeService } from './ai-chat-runtime.service';
import { createGeminiStreamingClient } from './gemini-ai.runtime';
import {
  asMock,
  asNever,
  history,
  streamOf,
} from './ai-chat-runtime.spec-support';

describe('AiChatRuntimeService Gemini tool repair', () => {
  beforeEach(() => {
    asMock(createGeminiStreamingClient).mockReset();
  });

  it('lets Gemini repair an invented tool name', async () => {
    const generateContentStream = jest
      .fn()
      .mockResolvedValueOnce(
        asNever(
          streamOf({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: 'sapling__generic_search',
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        asNever(
          streamOf({
            candidates: [
              { content: { parts: [{ text: 'Korrigierte Antwort.' }] } },
            ],
          }),
        ),
      );
    asMock(createGeminiStreamingClient).mockReturnValue({
      models: { generateContentStream },
    });
    const service = new AiChatRuntimeService({} as never);
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      service.streamGemini(
        history,
        {} as never,
        'gemini-2.5-pro',
        [
          {
            serverName: 'sapling',
            toolName: 'entity_search',
            inputSchema: { type: 'object' },
          },
        ] as never,
        { handle: 1 } as never,
        2,
        undefined,
        { onTextDelta },
        true,
      ),
    ).resolves.toMatchObject({ toolCalls: [] });

    const secondContents = (
      generateContentStream.mock.calls[1][0] as {
        contents: Array<Record<string, unknown>>;
      }
    ).contents;
    expect(JSON.stringify(secondContents)).toContain('sapling__entity_search');
    expect(JSON.stringify(secondContents)).toContain(
      '"trust":"untrusted-data"',
    );
    expect(onTextDelta).toHaveBeenCalledWith('Korrigierte Antwort.');
  });
});
