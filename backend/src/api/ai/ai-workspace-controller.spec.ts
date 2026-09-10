import { describe, expect, it, jest } from '@jest/globals';
jest.mock('./ai.service', () => ({ AiService: class {} }));
jest.mock('./mcp.service', () => ({ McpService: class {} }));
jest.mock('./ai-chat-queue.service', () => ({ AiChatQueueService: class {} }));
jest.mock('../../auth/guard/session-or-token-auth.guard', () => ({
  SessionOrBearerAuthGuard: class {},
}));
import { AiController } from './ai.controller';

describe('Workspace streaming HTTP boundary', () => {
  it('passes the workspace snapshot through the initial session creation', async () => {
    const ai = {
      createChatSession: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ handle: 42 }),
      streamChatMessage: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
    };
    const controller = new AiController(ai as never, {} as never, {} as never);
    const body = {
      content: 'Customer',
      sessionTitle: 'Customer assistant',
      workspaceInstruction: 'Prepare a customer',
      sourceDashboardHandle: 7,
      sourceWidgetId: 'customers',
      contextEntityHandle: null,
      contextRecordHandle: null,
    };
    const response = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      end: jest.fn(),
    };
    await controller.streamChat(
      { user: { handle: 1 } } as never,
      body,
      response as never,
    );
    expect(ai.createChatSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceInstruction: body.workspaceInstruction,
        sourceDashboardHandle: 7,
        sourceWidgetId: 'customers',
      }),
      { handle: 1 },
    );
    expect(ai.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionHandle: 42, contextRecordHandle: null }),
      { handle: 1 },
      expect.any(Function),
    );
  });
  it('does not recreate an existing session when a request supplies another instruction', async () => {
    const ai = {
      createChatSession: jest.fn(),
      streamChatMessage: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
    };
    const controller = new AiController(ai as never, {} as never, {} as never);
    await controller.streamChat(
      { user: { handle: 1 } } as never,
      {
        sessionHandle: 42,
        content: 'Next',
        workspaceInstruction: 'Different task',
      },
      { setHeader: jest.fn(), end: jest.fn() } as never,
    );
    expect(ai.createChatSession).not.toHaveBeenCalled();
  });
});
