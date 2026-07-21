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
