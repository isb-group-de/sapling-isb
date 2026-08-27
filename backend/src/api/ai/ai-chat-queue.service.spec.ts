import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';

jest.mock('./ai-chat-stream.service', () => ({
  AiChatStreamService: class {},
}));
jest.mock('./ai-chat-persistence.service', () => ({
  AiChatPersistenceService: class {},
}));
jest.mock('./ai-chat-coordinator.service', () => ({
  AiChatCoordinatorService: class {},
}));
jest.mock('../../entity/AiChatQueuedInputItem', () => ({
  AiChatQueuedInputItem: class {},
}));
jest.mock('../../entity/AiChatSessionItem', () => ({
  AiChatSessionItem: class {},
}));

import { AiChatQueueService } from './ai-chat-queue.service';

const asNever = (value: unknown): never => value as never;

describe('AiChatQueueService', () => {
  const session = { handle: 42, responseStatus: 'idle' };
  const person = { handle: 7 };
  let em: Record<string, jest.Mock>;
  let persistence: Record<string, jest.Mock>;
  let coordinator: Record<string, jest.Mock>;

  beforeEach(() => {
    em = {
      name: 'default' as never,
      fork: jest.fn(),
      create: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn().mockResolvedValue(asNever(undefined)),
      find: jest.fn(),
      findOne: jest.fn(),
      nativeUpdate: jest.fn().mockResolvedValue(asNever(1)),
      transactional: jest.fn(),
    };
    em.fork.mockImplementation(() => em as never);
    persistence = {
      findOwnedSession: jest.fn().mockResolvedValue(asNever(session)),
      requireManagedUser: jest.fn().mockResolvedValue(asNever(person)),
      requireUserHandle: jest.fn().mockReturnValue(7),
    };
    coordinator = {
      onIdle: jest.fn(),
      interrupt: jest.fn(),
      isRunning: jest.fn().mockReturnValue(true),
      run: jest.fn(),
    };
  });

  function createService() {
    return new AiChatQueueService(
      em as never,
      persistence as never,
      {} as never,
      coordinator as never,
    );
  }

  it('checks ownership and requests steer-first FIFO ordering', async () => {
    em.find.mockResolvedValue(
      asNever([
        {
          handle: 1,
          session,
          mode: 'steer',
          status: 'queued',
          content: 'Korrigiere das.',
        },
      ]),
    );

    const result = await createService().list(42, person as never);

    expect(persistence.findOwnedSession).toHaveBeenCalledWith(42, person);
    expect(em.find).toHaveBeenCalledWith(
      expect.any(Function),
      { session: { handle: 42 }, status: 'queued' },
      { orderBy: { mode: 'DESC', createdAt: 'ASC', handle: 'ASC' } },
    );
    expect(result[0]).toMatchObject({
      mode: 'steer',
      content: 'Korrigiere das.',
    });
  });

  it('persists steer input before interrupting the active run', async () => {
    const queued = {
      handle: 2,
      session,
      person,
      mode: 'steer',
      status: 'queued',
      content: 'Nutze außerdem den Kundenkontext.',
    };
    em.create.mockReturnValue(queued);

    const result = await createService().enqueue(
      {
        sessionHandle: 42,
        mode: 'steer',
        content: queued.content,
      },
      person as never,
    );

    expect(em.persist).toHaveBeenCalledWith(queued);
    expect(em.flush.mock.invocationCallOrder[0]).toBeLessThan(
      coordinator.interrupt.mock.invocationCallOrder[0],
    );
    expect(coordinator.interrupt).toHaveBeenCalledWith(42);
    expect(result).toMatchObject({
      handle: 2,
      mode: 'steer',
      status: 'queued',
    });
  });

  it('marks abandoned running inputs failed and releases their sessions on restart', async () => {
    const abandonedSession = { handle: 43, responseStatus: 'responding' };
    em.find
      .mockResolvedValueOnce(
        asNever([{ handle: 3, session: abandonedSession, status: 'running' }]),
      )
      .mockResolvedValueOnce(asNever([]));

    await createService().onModuleInit();

    expect(em.fork).toHaveBeenCalledWith({ useContext: true });
    expect(abandonedSession.responseStatus).toBe('idle');
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      expect.any(Function),
      { status: 'running' },
      expect.objectContaining({
        status: 'failed',
        errorPayload: { error: 'ai.chatQueueInterruptedByRestart' },
      }),
    );
  });

  it('creates a request context for idle-triggered background processing', async () => {
    jest.useFakeTimers();
    try {
      createService();
      const onIdle = coordinator.onIdle.mock.calls[0]?.[0] as
        ((sessionHandle: number) => void) | undefined;

      expect(onIdle).toBeDefined();
      onIdle?.(42);
      await jest.runAllTimersAsync();

      expect(em.fork).toHaveBeenCalledWith({ useContext: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not expose or cancel another persons queued input', async () => {
    em.findOne.mockResolvedValue(asNever(null));
    await expect(
      createService().cancel(99, person as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
