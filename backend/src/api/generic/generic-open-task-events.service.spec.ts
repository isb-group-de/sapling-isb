import { describe, expect, it, jest } from '@jest/globals';
import { GenericOpenTaskEventsService } from './generic-open-task-events.service';

describe('GenericOpenTaskEventsService', () => {
  it('notifies every participant and the creator of a private event', async () => {
    const findOne = jest
      .fn<(...args: unknown[]) => Promise<object>>()
      .mockResolvedValue({
        handle: 42,
        isPrivate: true,
        creatorPerson: { handle: 7 },
        status: { handle: 'scheduled' },
        participants: {
          getItems: () => [{ handle: 7 }, { handle: 9 }, { handle: 11 }],
        },
      });
    const em = {
      findOne,
    };
    const genericReferenceService = {
      normalizeHandleValue: jest.fn(() => 42),
    };
    const service = new GenericOpenTaskEventsService(
      em as never,
      genericReferenceService as never,
      { notifyUsers: jest.fn() } as never,
    );

    await expect(service.loadUserHandles('event', '42')).resolves.toEqual(
      new Set([7, 9, 11]),
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.any(Function),
      { handle: 42 },
      { populate: ['participants', 'status', 'creatorPerson'] },
    );
  });
});
