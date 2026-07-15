import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  AiAgentPolicyService,
  alignAssistantContentWithNavigationLinks,
  asMock,
  buildNavigationLink,
  buildNavigationLinks,
  createService,
  type ExecuteToolMock,
} from './ai.service.spec-support';

describe('AiService runtime and navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T08:15:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('normalizes scalar and serialized string-list values from dynamic forms', () => {
    const service = createService();
    const normalize = (value: unknown) =>
      (
        service as unknown as {
          normalizeStringArray: (input: unknown) => string[];
        }
      ).normalizeStringArray(value);

    expect(normalize('')).toEqual([]);
    expect(normalize('generic_create')).toEqual(['generic_create']);
    expect(normalize('["generic_create", " generic_update "]')).toEqual([
      'generic_create',
      'generic_update',
    ]);
    expect(normalize({ unexpected: true })).toEqual([]);
  });

  it('builds an agent policy when an empty JSON field was saved as a string', () => {
    const policyService = new AiAgentPolicyService({} as never);

    const policy = policyService.buildToolPolicy({
      allowedEntityHandles: 'ticket',
      allowedKnowledgeEntityHandles: '["ticket", " knowledgeArticle "]',
      allowedInternalTools: [' generic_create ', ''],
      allowedExternalTools: '',
    } as never);

    expect(policy).toEqual({
      allowedEntityHandles: ['ticket'],
      allowedKnowledgeEntityHandles: ['ticket', 'knowledgeArticle'],
      allowedInternalTools: ['generic_create'],
      allowedExternalTools: [],
      blockMutatingTools: true,
    });
  });

  it('includes the current server date in the system instruction', () => {
    const service = createService();

    const instruction = (
      service as never as {
        buildSystemInstruction: (options?: {
          includeToolGuidance?: boolean;
          user?: unknown;
          clientTimeContext?: unknown;
        }) => string;
      }
    ).buildSystemInstruction({ includeToolGuidance: true });

    expect(instruction).toContain(
      'Current UTC date and time: 2026-04-20T08:15:30.000Z.',
    );
    expect(instruction).toContain('Server local date: 2026-04-20.');
    expect(instruction).toContain(
      'Interpret relative date expressions such as "today", "yesterday", "this week", and "this month" using the',
    );
    expect(instruction).toContain(
      'Use available tools automatically when current Sapling data is needed.',
    );
  });

  it('uses the client timezone context for local date and time instructions', () => {
    const service = createService();

    const instruction = (
      service as never as {
        buildSystemInstruction: (options?: {
          includeToolGuidance?: boolean;
          user?: unknown;
          clientTimeContext?: unknown;
        }) => string;
      }
    ).buildSystemInstruction({
      clientTimeContext: {
        currentDate: new Date('2026-04-20T08:15:30.000Z'),
        timeZone: 'Europe/Berlin',
        locale: 'de-DE',
        utcOffsetMinutes: 120,
      },
    });

    expect(instruction).toContain(
      'Client reported current date and time: 2026-04-20T08:15:30.000Z.',
    );
    expect(instruction).toContain(
      'Client reported timezone offset at request time: UTC+02:00.',
    );
    expect(instruction).toContain('UTC+02:00 (Europe/Berlin).');
    expect(instruction).toContain('using the Europe/Berlin user locale date');
    expect(instruction).toContain(
      'use 20:00 Europe/Berlin rather than 20:00 UTC unless UTC is explicitly requested',
    );
  });

  it('returns only the latest message page in ascending order with pagination metadata', async () => {
    const em = {
      findOne: jest
        .fn<() => Promise<Record<string, unknown> | null>>()
        .mockResolvedValueOnce({
          handle: 5,
          person: { handle: 9 },
        })
        .mockResolvedValueOnce({
          handle: 5,
          person: { handle: 9 },
        }),
      find: jest
        .fn<() => Promise<Record<string, unknown>[]>>()
        .mockResolvedValue([
          {
            handle: 105,
            person: { handle: 9 },
            session: { handle: 5 },
            role: 'assistant',
            status: 'completed',
            sequence: 105,
            content: 'Newest',
          },
          {
            handle: 104,
            person: { handle: 9 },
            session: { handle: 5 },
            role: 'user',
            status: 'completed',
            sequence: 104,
            content: 'Middle',
          },
          {
            handle: 103,
            person: { handle: 9 },
            session: { handle: 5 },
            role: 'assistant',
            status: 'completed',
            sequence: 103,
            content: 'Older',
          },
        ]),
    };
    const service = createService(em);

    const result = await service.listChatMessages(5, { handle: 9 } as never, {
      limit: 2,
    });

    expect(asMock(em.find)).toHaveBeenCalledWith(
      expect.any(Function),
      {
        session: { handle: 5 },
        person: { handle: 9 },
      },
      {
        orderBy: { sequence: 'DESC' },
        limit: 3,
      },
    );
    expect(result.data.map((message) => message.sequence)).toEqual([104, 105]);
    expect(result.meta).toEqual({
      limit: 2,
      hasMore: true,
      nextBeforeSequence: 104,
    });
  });

  it('loads only the most recent stream history window', async () => {
    const em = {
      find: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    };
    const service = createService(em);

    await (
      service as never as {
        loadSessionHistory: (
          sessionHandle: number,
          userHandle: number,
        ) => Promise<unknown>;
      }
    ).loadSessionHistory(7, 11);

    expect(asMock(em.find)).toHaveBeenCalledWith(
      expect.any(Function),
      {
        session: { handle: 7 },
        person: { handle: 11 },
      },
      {
        orderBy: { sequence: 'DESC' },
        limit: 25,
      },
    );
  });

  it('builds record navigation links for generic_get results', () => {
    const link = buildNavigationLink({
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'generic_get',
      arguments: {
        entityHandle: 'project',
        handle: 11,
      },
      rawResult: {
        entityHandle: 'project',
        handle: 11,
        found: true,
        record: { handle: 11, title: 'Alpha' },
      },
    });

    expect(link).toMatchObject({
      path: '/table/project?filter=%7B%22handle%22%3A11%7D',
      entityHandle: 'project',
      kind: 'record',
      intent: 'record',
      resultCount: 1,
      recordHandles: [11],
    });
  });

  it('prefers direct entityRoute paths from generic_get results', () => {
    const link = buildNavigationLink({
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'generic_get',
      arguments: {
        entityHandle: 'entityRoute',
        handle: 8,
      },
      rawResult: {
        found: true,
        record: {
          handle: 8,
          route: 'dashboard/overview',
        },
      },
    });

    expect(link).toMatchObject({
      path: '/dashboard/overview',
      entityHandle: 'entityRoute',
      kind: 'route',
      intent: 'route',
      resultCount: 1,
    });
  });

  it('builds list navigation links for ticket_search results', () => {
    const link = buildNavigationLink({
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'ticket_search',
      arguments: {
        query: 'Sage 100',
        searchMode: 'solution',
      },
      rawResult: {
        appliedFilter: {
          $or: [{ solutionDescription: { $ilike: '%Sage 100%' } }],
        },
        data: [
          { handle: 12, title: 'Sage 100 startet nicht' },
          { handle: 15, title: 'Sage 100 Update' },
        ],
      },
    });

    expect(link).toMatchObject({
      path: '/table/ticket?filter=%7B%22handle%22%3A%7B%22%24in%22%3A%5B12%2C15%5D%7D%7D',
      entityHandle: 'ticket',
      kind: 'list',
      intent: 'searchResults',
      resultCount: 2,
      recordHandles: [12, 15],
    });
  });

  it('does not build navigation links for empty generic_list results', () => {
    const link = buildNavigationLink({
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'generic_list',
      arguments: {
        entityHandle: 'ticket',
        filter: { title: { $ilike: '%missing%' } },
      },
      rawResult: {
        entityHandle: 'ticket',
        data: [],
        meta: { total: 0 },
      },
    });

    expect(link).toBeNull();
  });

  it('does not build navigation links for pending confirmation actions', () => {
    const link = buildNavigationLink({
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'generic_update',
      arguments: {
        entityHandle: 'ticket',
        handle: 12,
        data: { title: 'Updated' },
      },
      status: 'blocked',
      rawResult: {
        pendingToolAction: true,
        actionHandle: 42,
      },
    });

    expect(link).toBeNull();
  });

  it('builds grouped navigation links for mixed knowledge_search results', () => {
    const links = buildNavigationLinks([
      {
        serverHandle: 0,
        serverName: 'sapling',
        toolName: 'knowledge_search',
        arguments: {
          query: 'Sage startet nicht',
        },
        rawResult: {
          results: [
            { entityHandle: 'ticket', handle: 12, score: 0.9 },
            { entityHandle: 'knowledgeArticle', handle: 5, score: 0.8 },
            { entityHandle: 'ticket', handle: 13, score: 0.7 },
          ],
        },
      },
    ]);

    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      entityHandle: 'ticket',
      kind: 'list',
      resultCount: 2,
      recordHandles: [12, 13],
      isPrimary: true,
    });
    expect(links[1]).toMatchObject({
      entityHandle: 'knowledgeArticle',
      kind: 'record',
      resultCount: 1,
      recordHandles: [5],
      isPrimary: false,
    });
  });

  it('keeps hard-coded tool guidance limited to runtime rules', () => {
    const service = createService();

    const instruction = (
      service as never as {
        buildSystemInstruction: (options?: {
          includeToolGuidance?: boolean;
        }) => string;
      }
    ).buildSystemInstruction({ includeToolGuidance: true });

    expect(instruction).toContain(
      'If a tool returns queryExecuted:false with status needs_schema_retry',
    );
    expect(instruction).toContain('Do not invent URLs');
    expect(instruction).not.toContain(
      'use semantic_search with entityHandle ticket first',
    );
    expect(instruction).not.toContain(
      'Use ticket_search for exact ticket numbers',
    );
  });

  it('instructs Songbird not to expose internal handles in user-facing prose', () => {
    const service = createService();

    const instruction = (
      service as never as {
        buildSystemInstruction: (options?: {
          includeToolGuidance?: boolean;
        }) => string;
      }
    ).buildSystemInstruction({ includeToolGuidance: true });

    expect(instruction).toContain(
      'Do not expose internal technical identifiers such as raw record handles',
    );
    expect(instruction).toContain(
      'You may still mention explicit user-facing business identifiers such as a ticket number or external number',
    );
  });

  it('resolves Gemini tool calls by raw tool name when the server prefix is omitted', async () => {
    const mcpService = {
      executeTool: jest.fn<ExecuteToolMock>().mockResolvedValue({
        serverHandle: 0,
        serverName: 'sapling',
        toolName: 'current_person',
        content: '{}',
        rawResult: {},
      }),
    };
    const service = createService({}, mcpService);

    await (
      service as never as {
        executeAutomaticToolCall: (
          toolRegistry: Array<{
            encodedName: string;
            descriptor: {
              serverName: string;
              toolName: string;
            };
          }>,
          encodedName: string,
          args: Record<string, unknown>,
          user: unknown,
        ) => Promise<unknown>;
      }
    ).executeAutomaticToolCall(
      [
        {
          encodedName: 'sapling__current_person',
          descriptor: {
            serverName: 'sapling',
            toolName: 'current_person',
          },
        },
      ],
      'current_person',
      {},
      { handle: 1 },
    );

    expect(mcpService.executeTool).toHaveBeenCalledWith(
      'sapling',
      'current_person',
      {},
      { handle: 1 },
    );
  });

  it('resolves Gemini tool calls when consecutive underscores are collapsed', async () => {
    const mcpService = {
      executeTool: jest.fn<ExecuteToolMock>().mockResolvedValue({
        serverHandle: 0,
        serverName: 'sapling',
        toolName: 'semantic_search',
        content: '{}',
        rawResult: {},
      }),
    };
    const service = createService({}, mcpService);

    await (
      service as never as {
        executeAutomaticToolCall: (
          toolRegistry: Array<{
            encodedName: string;
            descriptor: {
              serverName: string;
              toolName: string;
            };
          }>,
          encodedName: string,
          args: Record<string, unknown>,
          user: unknown,
        ) => Promise<unknown>;
      }
    ).executeAutomaticToolCall(
      [
        {
          encodedName: 'sapling__semantic_search',
          descriptor: {
            serverName: 'sapling',
            toolName: 'semantic_search',
          },
        },
      ],
      'sapling_semantic_search',
      { entityHandle: 'ticket', query: 'Sage startet nicht' },
      { handle: 1 },
    );

    expect(mcpService.executeTool).toHaveBeenCalledWith(
      'sapling',
      'semantic_search',
      { entityHandle: 'ticket', query: 'Sage startet nicht' },
      { handle: 1 },
    );
  });

  it('replaces hallucinated Sapling URLs with the canonical navigation link', () => {
    const normalizedContent = alignAssistantContentWithNavigationLinks(
      'Du kannst das Ticket hier einsehen: https://sapling.ai/partner/ticket/12',
      [
        {
          path: '/table/ticket?filter=%7B%22handle%22%3A%7B%22%24in%22%3A%5B12%5D%7D%7D',
          entityHandle: 'ticket',
          kind: 'list',
        },
      ],
      'http://localhost:5173/dashboard',
    );

    expect(normalizedContent).toBe(
      'Du kannst das Ticket hier einsehen: http://localhost:5173/table/ticket?filter=%7B%22handle%22%3A%7B%22%24in%22%3A%5B12%5D%7D%7D',
    );
  });
});
