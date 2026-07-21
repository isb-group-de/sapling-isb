import { describe, expect, it, jest } from '@jest/globals';

jest.mock('./ai-agent-context.service', () => ({
  AiAgentContextService: class {},
}));
jest.mock('./ai-agent-policy.service', () => ({
  AiAgentPolicyService: class {},
}));
jest.mock('./ai-chat-persistence.service', () => ({
  AiChatPersistenceService: class {},
}));
jest.mock('./ai-provider-registry.service', () => ({
  AiProviderRegistryService: class {},
}));

import { AiChatSessionService } from './ai-chat-session.service';

describe('AiChatSessionService', () => {
  it('filters archived sessions only while the archive option is disabled', async () => {
    const find = jest
      .fn<
        (entity: unknown, where: unknown, options: unknown) => Promise<never[]>
      >()
      .mockResolvedValue([]);
    const service = new AiChatSessionService(
      { find } as never,
      {} as never,
      {} as never,
      {} as never,
      { requireUserHandle: () => 42 } as never,
    );

    await service.listChatSessions({ handle: 42 } as never, false);
    await service.listChatSessions({ handle: 42 } as never, true);

    expect(find.mock.calls[0]?.[1]).toEqual({
      person: { handle: 42 },
      isArchived: false,
    });
    expect(find.mock.calls[1]?.[1]).toEqual({
      person: { handle: 42 },
    });
  });

  it('recovers stale persisted responses and their streaming messages', async () => {
    const staleSession = {
      handle: 9,
      title: 'Interrupted chat',
      isArchived: false,
      responseStatus: 'responding',
      responseActivityAt: new Date(0),
      person: 42,
    };
    const nativeUpdate = jest
      .fn<(entity: unknown, where: unknown, data: unknown) => Promise<number>>()
      .mockResolvedValue(1);
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = new AiChatSessionService(
      {
        find: jest
          .fn<() => Promise<(typeof staleSession)[]>>()
          .mockResolvedValue([staleSession]),
        nativeUpdate,
        flush,
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { requireUserHandle: () => 42 } as never,
    );

    const sessions = await service.listChatSessions(
      { handle: 42 } as never,
      false,
    );

    expect(staleSession.responseStatus).toBe('idle');
    expect(sessions[0]?.lastResponseAt).toBeInstanceOf(Date);
    expect(sessions[0]?.lastResponseAt?.getTime()).toBeGreaterThan(0);
    expect(nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      {
        session: { handle: { $in: [9] } },
        status: 'streaming',
      },
      { status: 'failed' },
    );
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('persists the read marker on the owned session', async () => {
    const session: {
      handle: number;
      title: string;
      isArchived: boolean;
      responseStatus: string;
      person: number;
      lastReadAt?: Date;
    } = {
      handle: 9,
      title: 'Read chat',
      isArchived: false,
      responseStatus: 'idle',
      person: 42,
    };
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const populateChatSession = jest
      .fn<(session: unknown) => Promise<void>>()
      .mockResolvedValue(undefined);
    const service = new AiChatSessionService(
      { flush } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        findOwnedSession: jest
          .fn<() => Promise<typeof session>>()
          .mockResolvedValue(session),
        populateChatSession,
      } as never,
    );

    const result = await service.markChatSessionRead(9, {
      handle: 42,
    } as never);

    expect(session).toHaveProperty('lastReadAt', expect.any(Date));
    expect(result.lastReadAt).toEqual(session.lastReadAt);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(populateChatSession).toHaveBeenCalledWith(session);
  });
});
