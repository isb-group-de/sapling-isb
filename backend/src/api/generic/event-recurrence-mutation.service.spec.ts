import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import type { EntityManager } from '@mikro-orm/core';
import type { EventItem } from '../../entity/EventItem';
import type { PersonItem } from '../../entity/PersonItem';
import type { GenericEntityMutationService } from './generic-entity-mutation.service';
import { EventRecurrenceMutationService } from './event-recurrence-mutation.service';

function createEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    handle: 42,
    title: 'Planning',
    startDate: new Date('2026-07-28T11:00:00.000Z'),
    endDate: new Date('2026-07-28T12:00:00.000Z'),
    isAllDay: false,
    isPrivate: false,
    recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,WE;COUNT=2',
    preparationDuration: '00:00:00',
    followUpDuration: '00:00:00',
    category: { handle: 'internal' },
    participants: {
      getItems: () => [{ handle: 7 }, { handle: 9 }],
    },
    ...overrides,
  } as unknown as EventItem;
}

function createHarness(event: EventItem) {
  const em = {
    findOne: jest.fn(async () => event),
    transactional: jest.fn(async (callback: () => Promise<void>) => callback()),
  } as unknown as EntityManager;
  const mutationService = {
    create: jest.fn(async () => ({ handle: 43 })),
    update: jest.fn(async () => ({ handle: 42 })),
    schedulePostCommitTasks: jest.fn(),
  } as unknown as GenericEntityMutationService;

  return {
    em,
    mutationService,
    service: new EventRecurrenceMutationService(em, mutationService),
  };
}

describe('EventRecurrenceMutationService', () => {
  it('atomically clears the source recurrence and creates later standalone events', async () => {
    const harness = createHarness(createEvent());

    await expect(
      harness.service.materialize(
        42,
        { expectedUpdatedAt: '2026-07-30T08:00:00.000Z' },
        { handle: 5 } as PersonItem,
        {},
      ),
    ).resolves.toEqual({
      materializedCount: 2,
      handles: [42, 43],
    });

    expect(harness.em.transactional).toHaveBeenCalledTimes(1);
    expect(harness.mutationService.update).toHaveBeenCalledWith(
      'event',
      42,
      { recurrenceRule: null },
      expect.any(Object),
      [],
      {},
      {
        expectedUpdatedAt: '2026-07-30T08:00:00.000Z',
        resolution: 'detect',
      },
      expect.objectContaining({ postCommitTasks: expect.any(Array) }),
    );
    expect(harness.mutationService.create).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({
        startDate: new Date('2026-07-29T11:00:00.000Z'),
        endDate: new Date('2026-07-29T12:00:00.000Z'),
        recurrenceRule: null,
        participants: [7, 9],
      }),
      expect.any(Object),
      {},
      expect.objectContaining({ postCommitTasks: expect.any(Array) }),
    );
    expect(
      harness.mutationService.schedulePostCommitTasks,
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects open-ended recurrences before mutating records', async () => {
    const harness = createHarness(
      createEvent({ recurrenceRule: 'FREQ=DAILY;INTERVAL=1' }),
    );

    await expect(
      harness.service.materialize(42, {}, { handle: 5 } as PersonItem, {}),
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'event.recurrenceFiniteRequired',
      } satisfies Partial<BadRequestException>),
    );
    expect(harness.mutationService.update).not.toHaveBeenCalled();
    expect(harness.mutationService.create).not.toHaveBeenCalled();
  });
});
