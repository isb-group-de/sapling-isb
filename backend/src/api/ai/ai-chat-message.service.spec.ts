import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('./ai-agent-context.service', () => ({
  AiAgentContextService: class {},
}));
jest.mock('./ai-chat-persistence.service', () => ({
  AiChatPersistenceService: class {},
}));
jest.mock('./ai-chat-session.service', () => ({
  AiChatSessionService: class {},
}));
jest.mock('./ai-provider-registry.service', () => ({
  AiProviderRegistryService: class {},
}));

import { AiChatMessageService } from './ai-chat-message.service';

describe('AiChatMessageService ratings', () => {
  it('persists a rating on an owned assistant response', async () => {
    const message = {
      handle: 17,
      session: 9,
      person: 42,
      role: 'assistant',
      status: 'completed',
      sequence: 2,
      content: 'Antwort',
      rating: null,
    };
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const findOwnedMessage = jest
      .fn<(handle: number, user: unknown) => Promise<typeof message>>()
      .mockResolvedValue(message);
    const service = new AiChatMessageService(
      { flush } as never,
      {} as never,
      {} as never,
      { findOwnedMessage } as never,
      {} as never,
    );
    const user = { handle: 42 } as never;

    const result = await service.updateChatMessageRating(
      17,
      { rating: -1 },
      user,
    );

    expect(findOwnedMessage).toHaveBeenCalledWith(17, user);
    expect(message.rating).toBe(-1);
    expect(result.rating).toBe(-1);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('rejects ratings for user messages', async () => {
    const message = {
      handle: 18,
      session: 9,
      person: 42,
      role: 'user',
      status: 'completed',
      sequence: 1,
      content: 'Frage',
      rating: null,
    };
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = new AiChatMessageService(
      { flush } as never,
      {} as never,
      {} as never,
      {
        findOwnedMessage: jest
          .fn<() => Promise<typeof message>>()
          .mockResolvedValue(message),
      } as never,
      {} as never,
    );

    await expect(
      service.updateChatMessageRating(18, { rating: 1 }, {
        handle: 42,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(flush).not.toHaveBeenCalled();
  });
});
