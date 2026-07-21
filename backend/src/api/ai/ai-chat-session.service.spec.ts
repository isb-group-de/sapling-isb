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
});
