import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  createService,
  type ExecuteToolResult,
} from './ai.service.spec-support';

describe('AiService tool actions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T08:15:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks confirmed tool actions as failed when the tool returns an error payload', async () => {
    const action = {
      handle: 1,
      status: 'pending',
      session: { handle: 2 },
      message: {
        handle: 3,
        responsePayload: {
          pendingToolActions: [
            {
              handle: 1,
              status: 'pending',
              serverName: 'sapling',
              toolName: 'import_execute_batch',
            },
          ],
        },
      },
      person: { handle: 9 },
      agent: 'importStrategyAgent',
      serverName: 'sapling',
      toolName: 'import_execute_batch',
      arguments: { batchHandle: 2 },
      errorPayload: null as unknown,
      createdAt: new Date('2026-04-20T08:15:30.000Z'),
      updatedAt: new Date('2026-04-20T08:15:30.000Z'),
    };
    const em = {
      clear: jest.fn(),
      findOne: jest
        .fn<() => Promise<typeof action | null>>()
        .mockResolvedValue(action),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const mcpService = {
      executeTool: jest
        .fn<() => Promise<ExecuteToolResult>>()
        .mockResolvedValue({
          serverHandle: 0,
          serverName: 'sapling',
          toolName: 'import_execute_batch',
          content: '{"ok":false,"error":"import.failed"}',
          rawResult: { ok: false, error: 'import.failed' },
          modelResult: { ok: false, error: 'import.failed' },
        }),
    };
    const agentPolicy = {
      buildToolPolicy: jest.fn().mockReturnValue({}),
    };
    const service = createService(
      em,
      mcpService,
      {},
      {},
      {},
      undefined,
      agentPolicy,
    );

    const result = await service.confirmToolAction(1, { handle: 9 } as never);

    expect(result.status).toBe('failed');
    expect(action.status).toBe('failed');
    expect(action.errorPayload).toEqual({ error: 'import.failed' });
    expect(action.message.responsePayload).toMatchObject({
      pendingToolActions: [
        {
          handle: 1,
          status: 'failed',
          errorPayload: { error: 'import.failed' },
        },
      ],
    });
    expect(em.flush).toHaveBeenCalled();
    expect(em.clear).toHaveBeenCalled();
  });

  it('returns an already completed tool action instead of failing a duplicate confirm', async () => {
    const action = {
      handle: 1,
      status: 'executed',
      session: { handle: 2 },
      message: { handle: 3 },
      person: { handle: 9 },
      agent: 'importStrategyAgent',
      serverName: 'sapling',
      toolName: 'import_execute_batch',
      arguments: { batchHandle: 2 },
      createdAt: new Date('2026-04-20T08:15:30.000Z'),
      updatedAt: new Date('2026-04-20T08:15:30.000Z'),
    };
    const em = {
      findOne: jest
        .fn<() => Promise<typeof action | null>>()
        .mockResolvedValue(action),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const mcpService = {
      executeTool: jest.fn(),
    };
    const service = createService(em, mcpService);

    const result = await service.confirmToolAction(1, { handle: 9 } as never);

    expect(result.status).toBe('executed');
    expect(mcpService.executeTool).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('does not prepare import execution actions for unvalidated batches', async () => {
    const importService = {
      getBatch: jest
        .fn<
          () => Promise<{
            handle: number;
            status: string;
            entityHandle: string;
            readyCount: number;
          }>
        >()
        .mockResolvedValue({
          handle: 2,
          status: 'analyzed',
          entityHandle: 'product',
          readyCount: 0,
        }),
    };
    const service = createService(
      {},
      {},
      {},
      {},
      {},
      undefined,
      {},
      importService,
    );

    const result = await (
      service as never as {
        preflightPendingToolAction: (
          descriptor: {
            serverHandle: number;
            serverName: string;
            toolName: string;
          },
          args: Record<string, unknown>,
        ) => Promise<ExecuteToolResult | null>;
      }
    ).preflightPendingToolAction(
      {
        serverHandle: 0,
        serverName: 'sapling',
        toolName: 'import_execute_batch',
      },
      { batchHandle: 2 },
    );

    expect(result?.modelResult).toMatchObject({
      ok: false,
      pendingToolAction: false,
      error: 'import.batchNotReadyForExecution',
    });
  });

  it('does not prepare a confirmation action when mutation preflight requires schema repair', async () => {
    const mutationRepair = {
      serverHandle: 0,
      serverName: 'sapling',
      toolName: 'generic_update',
      arguments: {
        entityHandle: 'company',
        handle: 1939,
        data: { employees: '3000-5000' },
      },
      content: '{"status":"needs_schema_retry"}',
      modelResult: {
        mutationExecuted: false,
        pendingToolAction: false,
        status: 'needs_schema_retry',
        invalidFields: [{ fieldName: 'employees' }],
      },
      rawResult: {
        mutationExecuted: false,
        pendingToolAction: false,
        status: 'needs_schema_retry',
        invalidFields: [{ fieldName: 'employees' }],
      },
    };
    const em = {
      create: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn(),
    };
    const mcpService = {
      preflightTool: jest
        .fn<() => Promise<typeof mutationRepair>>()
        .mockResolvedValue(mutationRepair),
      executeTool: jest.fn(),
    };
    const agentPolicy = {
      isMutatingTool: jest.fn().mockReturnValue(true),
    };
    const service = createService(
      em,
      mcpService,
      {},
      {},
      {},
      undefined,
      agentPolicy,
    );

    const result = await (
      service as unknown as {
        toolActions: {
          executePolicyAwareToolCall: (...args: unknown[]) => Promise<unknown>;
        };
      }
    ).toolActions.executePolicyAwareToolCall(
      {
        encodedName: 'sapling__generic_update',
        descriptor: {
          serverHandle: 0,
          serverName: 'sapling',
          toolName: 'generic_update',
        },
      },
      mutationRepair.arguments,
      { handle: 9 },
      { handle: 9 },
      { handle: 2 },
      { handle: 3 },
      { handle: 'songbirdGeneral', mutationMode: 'confirm' },
      {},
      jest.fn(),
    );

    expect(result).toBe(mutationRepair);
    expect(mcpService.preflightTool).toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('preflights a protected mutation and creates a pending confirmation action', async () => {
    const now = new Date('2026-04-20T08:15:30.000Z');
    const em = {
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        handle: 41,
        ...payload,
        createdAt: now,
        updatedAt: now,
      })),
      persist: jest.fn(),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const mcpService = {
      preflightTool: jest.fn(
        async (
          _serverName: string,
          _toolName: string,
          _args: Record<string, unknown>,
          _user: unknown,
          policy: { blockMutatingTools?: boolean },
        ) => {
          if (policy.blockMutatingTools) {
            throw new Error('ai.agentToolRequiresConfirmation');
          }

          return null;
        },
      ),
      executeTool: jest.fn(),
    };
    const agentPolicy = {
      isMutatingTool: jest.fn().mockReturnValue(true),
    };
    const service = createService(
      em,
      mcpService,
      {},
      {},
      {},
      undefined,
      agentPolicy,
    );
    const onEvent = jest.fn();
    const policy = {
      allowedEntityHandles: ['company'],
      allowedInternalTools: ['generic_create'],
      blockMutatingTools: true,
    };

    const result = await (
      service as unknown as {
        toolActions: {
          executePolicyAwareToolCall: (...args: unknown[]) => Promise<{
            modelResult: Record<string, unknown>;
          }>;
        };
      }
    ).toolActions.executePolicyAwareToolCall(
      {
        encodedName: 'sapling__generic_create',
        descriptor: {
          serverHandle: 0,
          serverName: 'sapling',
          toolName: 'generic_create',
        },
      },
      { entityHandle: 'company', data: { name: 'Enpal' } },
      { handle: 9 },
      { handle: 9 },
      { handle: 2 },
      { handle: 3 },
      { handle: 'songbirdGeneral', mutationMode: 'confirm' },
      policy,
      onEvent,
    );

    expect(mcpService.preflightTool).toHaveBeenCalledWith(
      'sapling',
      'generic_create',
      { entityHandle: 'company', data: { name: 'Enpal' } },
      { handle: 9 },
      {
        ...policy,
        blockMutatingTools: false,
      },
    );
    expect(em.persist).toHaveBeenCalled();
    expect(em.flush).toHaveBeenCalled();
    expect(em.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        expiresAt: new Date('2026-04-20T18:15:30.000Z'),
      }),
    );
    expect(result.modelResult).toMatchObject({
      pendingToolAction: true,
      actionHandle: 41,
      toolName: 'generic_create',
      status: 'pending',
    });
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool.action.pending',
        action: expect.objectContaining({
          handle: 41,
          toolName: 'generic_create',
          status: 'pending',
        }),
      }),
    );
    expect(mcpService.executeTool).not.toHaveBeenCalled();
  });

  it('creates a follow-up execution action after confirmed import configuration', async () => {
    const action = {
      handle: 4,
      status: 'pending',
      session: { handle: 2 },
      message: { handle: 3 },
      person: { handle: 9 },
      agent: null,
      serverName: 'sapling',
      toolName: 'import_configure_batch',
      arguments: { batchHandle: 4, entityHandle: 'product' },
      resultPayload: null as unknown,
      errorPayload: null as unknown,
      createdAt: new Date('2026-04-20T08:15:30.000Z'),
      updatedAt: new Date('2026-04-20T08:15:30.000Z'),
    };
    const em = {
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        handle: 44,
        ...payload,
        createdAt: new Date('2026-04-20T08:15:30.000Z'),
        updatedAt: new Date('2026-04-20T08:15:30.000Z'),
      })),
      findOne: jest
        .fn<() => Promise<typeof action | null>>()
        .mockResolvedValue(action),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      persist: jest.fn(),
    };
    const mcpService = {
      executeTool: jest
        .fn<() => Promise<ExecuteToolResult>>()
        .mockResolvedValue({
          serverHandle: 0,
          serverName: 'sapling',
          toolName: 'import_configure_batch',
          content:
            '{"handle":4,"status":"validated","entityHandle":"product","readyCount":2}',
          rawResult: {
            handle: 4,
            status: 'validated',
            entityHandle: 'product',
            readyCount: 2,
          },
          modelResult: {
            handle: 4,
            status: 'validated',
            entityHandle: 'product',
            readyCount: 2,
          },
        }),
    };
    const agentPolicy = {
      buildToolPolicy: jest.fn().mockReturnValue({}),
    };
    const service = createService(
      em,
      mcpService,
      {},
      {},
      {},
      undefined,
      agentPolicy,
    );

    const result = await service.confirmToolAction(4, { handle: 9 } as never);
    const followUpToolAction = result.resultPayload?.followUpToolAction as
      Record<string, unknown> | undefined;

    expect(result.status).toBe('executed');
    expect(followUpToolAction).toMatchObject({
      handle: 44,
      serverName: 'sapling',
      toolName: 'import_execute_batch',
      status: 'pending',
      arguments: { batchHandle: 4 },
    });
  });
});
