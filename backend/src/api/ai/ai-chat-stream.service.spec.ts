import { afterEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('./ai-agent-context.service', () => ({
  AiAgentContextService: class {},
}));
jest.mock('./ai-agent-run-lifecycle.service', () => ({
  AiAgentRunLifecycleService: class {},
}));
jest.mock('./ai-chat-persistence.service', () => ({
  AiChatPersistenceService: class {},
}));
jest.mock('./ai-chat-runtime.service', () => ({
  AiChatRuntimeService: class {},
}));
jest.mock('./ai-chat-session.service', () => ({
  AiChatSessionService: class {},
}));
jest.mock('./ai-chat-tool-action.service', () => ({
  AiChatToolActionService: class {},
}));
jest.mock('./ai-provider-registry.service', () => ({
  AiProviderRegistryService: class {},
}));
jest.mock('./mcp.service', () => ({
  McpService: class {},
}));

import { AiChatStreamService } from './ai-chat-stream.service';

describe('AiChatStreamService persistence lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('checkpoints partial assistant text and persists terminal session state', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-21T10:00:00Z'));
    const fixture = createFixture();
    fixture.chatRuntime.streamOpenAi.mockImplementation(
      async (...args: unknown[]) => {
        const callbacks = args[7] as {
          onTextDelta: (delta: string) => Promise<void>;
        };
        jest.setSystemTime(new Date('2026-07-21T10:00:01Z'));
        await callbacks.onTextDelta('Partial answer');
        return { toolCalls: [], usagePayload: { outputTokens: 2 } };
      },
    );

    const result = await fixture.service.streamChatMessage(
      { sessionHandle: 7, content: 'Question' },
      fixture.person as never,
      fixture.onEvent,
    );

    expect(fixture.flushSnapshots).toContainEqual(
      expect.objectContaining({
        assistantContent: 'Partial answer',
        assistantStatus: 'streaming',
        responseStatus: 'responding',
      }),
    );
    expect(result.assistantMessage).toMatchObject({
      content: 'Partial answer',
      status: 'completed',
    });
    expect(result.session).toMatchObject({ responseStatus: 'idle' });
    expect(result.session.lastResponseAt).toBeInstanceOf(Date);
    expect(fixture.onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message.completed',
        message: expect.objectContaining({
          content: 'Partial answer',
          status: 'completed',
        }),
      }),
    );
  });

  it('renames an untitled session and emits a tool-specific progress step', async () => {
    const fixture = createFixture();
    fixture.session.title = 'New Chat';
    fixture.chatRuntime.streamOpenAi.mockImplementation(
      async (...args: unknown[]) => {
        const executeTool = args[10] as (
          entry: Record<string, unknown>,
          toolArguments: Record<string, unknown>,
        ) => Promise<unknown>;
        await executeTool(
          {
            descriptor: {
              serverHandle: 0,
              serverName: 'sapling',
              toolName: 'web_search',
            },
          },
          { query: 'Enpal Impressum' },
        );
        return { toolCalls: [], usagePayload: {} };
      },
    );

    await fixture.service.streamChatMessage(
      { sessionHandle: 7, content: 'Unternehmen aus dem Impressum anlegen' },
      fixture.person as never,
      fixture.onEvent,
    );

    expect(fixture.session.title).toBe('Unternehmen aus dem Impressum anlegen');
    expect(fixture.onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'progress.step',
        step: expect.objectContaining({
          labelKey: 'aiChat.progressWebSearch',
          toolName: 'web_search',
        }),
      }),
    );
  });

  it('persists a failed terminal message when run creation fails', async () => {
    const fixture = createFixture();
    fixture.agentRunLifecycle.createRun.mockRejectedValue(
      new Error('run unavailable'),
    );

    await expect(
      fixture.service.streamChatMessage(
        { sessionHandle: 7, content: 'Question' },
        fixture.person as never,
        fixture.onEvent,
      ),
    ).rejects.toThrow('run unavailable');

    expect(fixture.assistantMessage).toMatchObject({
      status: 'failed',
      responsePayload: expect.objectContaining({ error: 'run unavailable' }),
    });
    expect(fixture.session).toMatchObject({ responseStatus: 'idle' });
    expect(fixture.session.lastResponseAt).toBeInstanceOf(Date);
    expect(fixture.onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message.completed',
        message: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});

function createFixture() {
  const person = { handle: 42 };
  const session = {
    handle: 7,
    title: 'Question',
    isArchived: false,
    person,
    provider: null,
    model: null,
    agent: null,
    agentVersion: null,
    playbook: null,
    responseStatus: 'idle',
    lastMessageAt: null,
    responseActivityAt: null,
    lastResponseAt: null,
    lastReadAt: new Date(),
  };
  let assistantMessage: Record<string, unknown> | null = null;
  const flushSnapshots: Record<string, unknown>[] = [];
  const em = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => {
      const item = {
        ...data,
        handle: data.role === 'assistant' ? 12 : 11,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (data.role === 'assistant') assistantMessage = item;
      return item;
    }),
    persist: jest.fn(),
    flush: jest.fn(() => {
      flushSnapshots.push({
        assistantContent: assistantMessage?.content,
        assistantStatus: assistantMessage?.status,
        responseStatus: session.responseStatus,
      });
      return Promise.resolve();
    }),
  };
  const provider = {
    handle: 'openai',
    title: 'OpenAI',
    color: '#000000',
    isActive: true,
  };
  const model = {
    handle: 'gpt',
    title: 'GPT',
    provider,
    providerModel: 'gpt',
    supportsStreaming: true,
    supportsTools: false,
    maxToolCallIterations: 1,
    isActive: true,
  };
  const mcpService = {
    listActiveTools: jest.fn(() => Promise.resolve([])),
    tryExecuteInlineToolCommand: jest.fn(() => Promise.resolve(null)),
  };
  const chatRuntime = {
    streamOpenAi: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    streamGemini: jest.fn(),
  };
  const chatSession = {
    buildSessionTitle: jest.fn((content: string) => content.trim()),
    resolveInitialSessionTitle: jest.fn(
      (title: string | null | undefined, content: string) =>
        !title?.trim() || title.trim().toLocaleLowerCase() === 'new chat'
          ? content.trim()
          : title.trim(),
    ),
    isUntitledSessionTitle: jest.fn(
      (title: string | null | undefined) =>
        !title?.trim() || title.trim().toLocaleLowerCase() === 'new chat',
    ),
  };
  const toolActions = {
    executePolicyAwareToolCall: jest.fn(() =>
      Promise.resolve({ content: '{}', modelResult: {}, rawResult: {} }),
    ),
    loadPendingToolActionsForMessage: jest.fn(() => Promise.resolve([])),
  };
  const run = {
    handle: 21,
    session,
    message: null,
    person,
    agent: null,
    agentVersion: null,
    playbook: null,
    status: 'running',
    provider: 'openai',
    model: 'gpt',
    startedAt: new Date(),
    completedAt: null as Date | null,
  };
  const agentRunLifecycle = {
    createRun: jest.fn(() => Promise.resolve(run)),
    completeRun: jest.fn(
      (
        target: typeof run,
        payload: { status: string; responseText?: string },
      ) => {
        target.status = payload.status;
        target.completedAt = new Date();
        Object.assign(target, {
          responseText: payload.responseText ?? null,
          durationMs: 1,
        });
      },
    ),
    buildSources: jest.fn(() => []),
  };
  const chatPersistence = {
    requireManagedUser: jest.fn(() => Promise.resolve(person)),
    findOwnedSession: jest.fn(() => Promise.resolve(session)),
    getNextSequence: jest.fn(() => Promise.resolve(1)),
    resolveChatAttachmentsForMessage: jest.fn(() => Promise.resolve([])),
    buildChatAttachmentContext: jest.fn(() => []),
    mergeMessageContextPayload: jest.fn((payload: unknown) => payload ?? null),
    linkAttachmentsToMessage: jest.fn(() => Promise.resolve(undefined)),
    linkTranscriptionToMessage: jest.fn(() => Promise.resolve(undefined)),
    populateChatSession: jest.fn(() => Promise.resolve(undefined)),
    loadSessionHistory: jest.fn(() => Promise.resolve([])),
    requireUserHandle: jest.fn(() => 42),
  };
  const service = new AiChatStreamService(
    em as never,
    mcpService as never,
    {
      resolveRuntimeTarget: jest.fn(() =>
        Promise.resolve({
          provider,
          model,
          providerKind: 'openai',
        }),
      ),
    } as never,
    chatRuntime as never,
    agentRunLifecycle as never,
    {
      resolveAgentRuntimeContext: jest.fn(() =>
        Promise.resolve({
          agent: null,
          version: null,
          playbook: null,
          toolPolicy: {},
          instruction: null,
        }),
      ),
    } as never,
    chatPersistence as never,
    chatSession as never,
    toolActions as never,
  );
  const onEvent = jest.fn<(event: Record<string, unknown>) => void>();

  return {
    service,
    person,
    session,
    get assistantMessage() {
      return assistantMessage;
    },
    flushSnapshots,
    chatRuntime,
    agentRunLifecycle,
    onEvent,
  };
}
