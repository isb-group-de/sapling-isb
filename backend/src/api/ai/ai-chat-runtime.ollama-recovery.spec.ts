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
import { createOpenAiClient } from './openai-ai.runtime';
import {
  asMock,
  asNever,
  history,
  streamOf,
} from './ai-chat-runtime.spec-support';
import {
  AI_TOOL_RESULT_MAX_CHARACTERS,
  OPENAI_COMPATIBLE_CONTINUATION_PROMPT,
  OPENAI_COMPATIBLE_PARTIAL_RESULT_MESSAGE,
} from './ai-tool-result-context.utils';

const missingUserQueryError = () =>
  new Error('500 no user query found in messages');

describe('AiChatRuntimeService Ollama recovery', () => {
  beforeEach(() => {
    asMock(createOpenAiClient).mockReset();
  });

  it('continues a tool conversation with a fresh user turn after Ollama loses the query', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(asNever(toolCallStream()))
      .mockRejectedValueOnce(asNever(missingUserQueryError()))
      .mockResolvedValueOnce(
        asNever(
          streamOf(
            { choices: [{ delta: { content: 'Auswertung abgeschlossen.' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
          ),
        ),
      );
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    const result = await createRuntime().streamOpenAi(
      history,
      { handle: 'ollama' } as never,
      'qwen3.8:27b',
      [toolDescriptor()] as never,
      { handle: 1 } as never,
      3,
      undefined,
      { onTextDelta },
      true,
      null,
      toolExecutor() as never,
    );

    expect(result.toolCalls).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(3);
    const retryRequest = create.mock.calls[2][0] as {
      messages: Array<Record<string, unknown>>;
    };
    expect(retryRequest.messages.at(-1)).toEqual({
      role: 'user',
      content: OPENAI_COMPATIBLE_CONTINUATION_PROMPT,
    });
    expect(onTextDelta).toHaveBeenCalledWith('Auswertung abgeschlossen.');
  });

  it('returns a transparent partial result when the compact retry also fails', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(asNever(toolCallStream()))
      .mockRejectedValueOnce(asNever(missingUserQueryError()))
      .mockRejectedValueOnce(asNever(missingUserQueryError()));
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const onTextDelta = jest
      .fn<(delta: string) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      createRuntime().streamOpenAi(
        history,
        { handle: 'ollama' } as never,
        'qwen3.8:27b',
        [toolDescriptor()] as never,
        { handle: 1 } as never,
        3,
        undefined,
        { onTextDelta },
        true,
        null,
        toolExecutor() as never,
      ),
    ).resolves.toMatchObject({ toolCalls: [expect.any(Object)] });
    expect(onTextDelta).toHaveBeenCalledWith(
      OPENAI_COMPATIBLE_PARTIAL_RESULT_MESSAGE,
    );
  });

  it('limits each tool result before sending the next model request', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(asNever(toolCallStream()))
      .mockResolvedValueOnce(
        asNever(streamOf({ choices: [{ delta: {}, finish_reason: 'stop' }] })),
      );
    asMock(createOpenAiClient).mockReturnValue({
      chat: { completions: { create } },
    });
    const oversizedResult = JSON.stringify({ data: 'x'.repeat(100_000) });

    await createRuntime().streamOpenAi(
      history,
      { handle: 'ollama' } as never,
      'qwen3.8:27b',
      [toolDescriptor()] as never,
      { handle: 1 } as never,
      2,
      undefined,
      jest.fn<(delta: string) => Promise<void>>().mockResolvedValue(undefined),
      true,
      null,
      jest.fn().mockResolvedValue(
        asNever({
          serverHandle: 0,
          serverName: 'sapling',
          toolName: 'generic_list',
          arguments: { entityHandle: 'ticket' },
          content: oversizedResult,
          modelResult: oversizedResult,
          rawResult: oversizedResult,
        }),
      ) as never,
    );

    const secondRequest = create.mock.calls[1][0] as {
      messages: Array<Record<string, unknown>>;
    };
    const toolMessage = secondRequest.messages.find(
      (message) => message.role === 'tool',
    );
    const content = String(toolMessage?.content);
    expect(content.length).toBeLessThanOrEqual(AI_TOOL_RESULT_MAX_CHARACTERS);
    expect(JSON.parse(content)).toMatchObject({
      data: { truncated: true, continuationHint: expect.any(String) },
    });
  });
});

function createRuntime() {
  return new AiChatRuntimeService({} as never);
}

function toolCallStream() {
  return streamOf(
    {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call-1',
                function: {
                  name: 'sapling__generic_list',
                  arguments: '{"entityHandle":"ticket"}',
                },
              },
            ],
          },
        },
      ],
    },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
  );
}

function toolDescriptor() {
  return {
    serverName: 'sapling',
    toolName: 'generic_list',
    inputSchema: { type: 'object' },
  };
}

function toolExecutor() {
  return jest.fn().mockResolvedValue(
    asNever({
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'generic_list',
      arguments: { entityHandle: 'ticket' },
      content: JSON.stringify({ data: [{ handle: 1, title: 'Ticket' }] }),
      modelResult: { data: [{ handle: 1, title: 'Ticket' }] },
      rawResult: { data: [{ handle: 1, title: 'Ticket' }] },
    }),
  );
}
