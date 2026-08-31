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
import { createOpenAiClient } from './openai-ai.runtime';
import { AiChatInterruptedError } from './ai.types';

const asMock = (value: unknown): jest.Mock => value as jest.Mock;
const history = [
  { role: 'user', status: 'persisted', content: 'Hallo', contextPayload: null },
] as never;
const asNever = (value: unknown): never => value as never;

function streamOf(...events: unknown[]) {
  return (async function* () {
    for (const event of events) yield event;
  })();
}

describe('AiChatRuntimeService streaming', () => {
  beforeEach(() => {
    asMock(createOpenAiClient).mockReset();
    asMock(createGeminiStreamingClient).mockReset();
  });

  it('streams incremental text for OpenAI-compatible providers without reasoning events', async () => {
    const create = jest.fn().mockResolvedValue(
      asNever(
        streamOf(
          { choices: [{ delta: { content: 'Hallo ' } }], usage: null },
          {
            choices: [{ delta: { content: 'lokal.' } }],
            usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
          },
        ),
      ),
    );
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const service = new AiChatRuntimeService({} as never);
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    const result = await service.streamOpenAi(
      history,
      { handle: 'lmstudio' } as never,
      'local-model',
      [],
      { handle: 1 } as never,
      1,
      undefined,
      { onTextDelta },
      false,
    );

    expect(onTextDelta.mock.calls.map((call) => call[0])).toEqual([
      'Hallo ',
      'lokal.',
    ]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        stream_options: { include_usage: true },
      }),
      expect.any(Object),
    );
    expect(result.usagePayload).toMatchObject({
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
    });
  });

  it('accepts an Ollama response that terminates after its protocol completion marker', async () => {
    const create = jest.fn().mockResolvedValue(
      asNever(
        (async function* () {
          yield {
            choices: [{ delta: { content: 'Vollständige Antwort.' } }],
            usage: null,
          };
          yield {
            choices: [{ delta: {}, finish_reason: 'stop' }],
            usage: null,
          };
          throw new Error('terminated');
        })(),
      ),
    );
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const service = new AiChatRuntimeService({} as never);
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      service.streamOpenAi(
        history,
        { handle: 'ollama' } as never,
        'local-model',
        [],
        { handle: 1 } as never,
        1,
        undefined,
        { onTextDelta },
        false,
      ),
    ).resolves.toMatchObject({ toolCalls: [] });
    expect(onTextDelta).toHaveBeenCalledWith('Vollständige Antwort.');
  });

  it('still rejects an OpenAI-compatible stream that fails before completion', async () => {
    const create = jest.fn().mockResolvedValue(
      asNever(
        (async function* () {
          yield {
            choices: [{ delta: { content: 'Unvollständig' } }],
            usage: null,
          };
          throw new Error('terminated');
        })(),
      ),
    );
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const service = new AiChatRuntimeService({} as never);

    await expect(
      service.streamOpenAi(
        history,
        { handle: 'ollama' } as never,
        'local-model',
        [],
        { handle: 1 } as never,
        1,
        undefined,
        jest
          .fn<(delta: string) => Promise<void>>()
          .mockResolvedValue(undefined),
        false,
      ),
    ).rejects.toThrow('terminated');
  });

  it('lets an OpenAI-compatible model repair an invented tool name', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        asNever(
          streamOf(
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call-1',
                        function: {
                          name: 'sapling__generic_search',
                          arguments: '{}',
                        },
                      },
                    ],
                  },
                },
              ],
            },
            { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
          ),
        ),
      )
      .mockResolvedValueOnce(
        asNever(
          streamOf(
            { choices: [{ delta: { content: 'Korrigierte Antwort.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ),
        ),
      );
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const service = new AiChatRuntimeService({} as never);
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      service.streamOpenAi(
        history,
        { handle: 'ollama' } as never,
        'ornith:35b',
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

    const secondRequest = create.mock.calls[1][0] as {
      messages: Array<Record<string, unknown>>;
    };
    expect(secondRequest.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call-1',
          content: expect.stringContaining('sapling__entity_search'),
        }),
      ]),
    );
    expect(onTextDelta).toHaveBeenCalledWith('Korrigierte Antwort.');
  });

  it('lets an OpenAI Responses model repair an invented tool name', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        asNever(
          streamOf({
            type: 'response.completed',
            response: {
              output: [
                {
                  type: 'function_call',
                  call_id: 'call-1',
                  name: 'sapling__generic_search',
                  arguments: '{}',
                },
              ],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        asNever(
          streamOf(
            { type: 'response.output_text.delta', delta: 'Korrigiert.' },
            { type: 'response.completed', response: { output: [] } },
          ),
        ),
      );
    asMock(createOpenAiClient).mockReturnValue({ responses: { create } });
    const service = new AiChatRuntimeService({} as never);
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      service.streamOpenAi(
        history,
        { handle: 'openai' } as never,
        'gpt-5',
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

    const secondInput = (
      create.mock.calls[1][0] as { input: Record<string, unknown>[] }
    ).input;
    expect(secondInput).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call-1',
          output: expect.stringContaining('sapling__entity_search'),
        }),
      ]),
    );
    expect(onTextDelta).toHaveBeenCalledWith('Korrigiert.');
  });

  it('streams OpenAI Responses text and filtered reasoning summaries', async () => {
    const create = jest.fn().mockResolvedValue(
      asNever(
        streamOf(
          {
            type: 'response.reasoning_summary_text.delta',
            delta: 'Prüfe Kontext. ',
          },
          { type: 'response.output_text.delta', delta: 'Du bist ' },
          { type: 'response.output_text.delta', delta: 'Martin.' },
          {
            type: 'response.completed',
            response: {
              output: [{ type: 'message', role: 'assistant', content: [] }],
              usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
            },
          },
        ),
      ),
    );
    asMock(createOpenAiClient).mockReturnValue({ responses: { create } });
    const service = new AiChatRuntimeService({} as never);
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const onReasoningDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    const result = await service.streamOpenAi(
      history,
      { handle: 'openai' } as never,
      'gpt-5.6-sol',
      [],
      { handle: 1 } as never,
      2,
      undefined,
      { onTextDelta, onReasoningDelta },
      false,
      null,
      undefined,
      true,
    );

    expect(onTextDelta.mock.calls.map((call) => call[0])).toEqual([
      'Du bist ',
      'Martin.',
    ]);
    expect(onReasoningDelta).toHaveBeenCalledWith('Prüfe Kontext. ');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        store: false,
        reasoning: { summary: 'auto' },
        include: ['reasoning.encrypted_content'],
      }),
      expect.any(Object),
    );
    expect(result.usagePayload).toMatchObject({
      inputTokens: 8,
      outputTokens: 4,
    });
  });

  it('preserves Responses output across multiple tool rounds', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        asNever(
          streamOf({
            type: 'response.completed',
            response: {
              output: [
                {
                  type: 'function_call',
                  call_id: 'call-1',
                  name: 'sapling__current_person',
                  arguments: '{}',
                },
              ],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        asNever(
          streamOf(
            { type: 'response.output_text.delta', delta: 'Du bist Martin.' },
            { type: 'response.completed', response: { output: [] } },
          ),
        ),
      );
    asMock(createOpenAiClient).mockReturnValue({ responses: { create } });
    const service = new AiChatRuntimeService({} as never);
    const toolExecutor = jest.fn().mockResolvedValue(
      asNever({
        serverHandle: 0,
        serverName: 'sapling',
        toolName: 'current_person',
        arguments: {},
        content: '{"name":"Martin"}',
        modelResult: { name: 'Martin' },
        rawResult: { name: 'Martin' },
      }),
    );

    const result = await service.streamOpenAi(
      history,
      { handle: 'openai' } as never,
      'gpt-5',
      [
        {
          serverName: 'sapling',
          toolName: 'current_person',
          inputSchema: { type: 'object' },
        },
      ] as never,
      { handle: 1 } as never,
      3,
      undefined,
      jest.fn<(delta: string) => Promise<void>>().mockResolvedValue(undefined),
      true,
      null,
      toolExecutor as never,
    );

    expect(toolExecutor).toHaveBeenCalledTimes(1);
    expect(result.toolCalls).toHaveLength(1);
    const secondInput = (
      create.mock.calls[1][0] as { input: Record<string, unknown>[] }
    ).input;
    expect(secondInput).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'function_call', call_id: 'call-1' }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call-1',
        }),
      ]),
    );
  });

  it('normalizes aborts and streams Gemini thought summaries without exposing signatures', async () => {
    const generateContentStream = jest.fn().mockResolvedValue(
      asNever(
        streamOf({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Kontext prüfen. ',
                    thought: true,
                    thoughtSignature: 'encrypted',
                  },
                  { text: 'Antwort.' },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2 },
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
    const onReasoningDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    await service.streamGemini(
      history,
      {} as never,
      'gemini-2.5-pro',
      [],
      { handle: 1 } as never,
      1,
      undefined,
      { onTextDelta, onReasoningDelta },
      false,
      null,
      undefined,
      true,
    );
    expect(onReasoningDelta).toHaveBeenCalledWith('Kontext prüfen. ');
    expect(onTextDelta).toHaveBeenCalledWith('Antwort.');

    const controller = new AbortController();
    controller.abort();
    await expect(
      service.streamGemini(
        history,
        {} as never,
        'gemini-2.5-pro',
        [],
        { handle: 1 } as never,
        1,
        undefined,
        { onTextDelta, signal: controller.signal },
        false,
      ),
    ).rejects.toBeInstanceOf(AiChatInterruptedError);
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
    expect(onTextDelta).toHaveBeenCalledWith('Korrigierte Antwort.');
  });
});
