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
    recurrenceExceptionDates: [],
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
  it('updates one master for 200 completed occurrences', async () => {
    const start = new Date('2026-01-01T11:00:00Z');
    const harness = createHarness(
      createEvent({
        startDate: start,
        endDate: new Date('2026-01-01T12:00:00Z'),
        recurrenceRule: 'FREQ=DAILY;COUNT=200',
      }),
    );
    const starts = Array.from({ length: 200 }, (_, index) =>
      new Date(start.getTime() + index * 86400000).toISOString(),
    );
    await harness.service.detachOccurrences(
      42,
      { occurrenceStarts: starts, event: { status: 'completed' } },
      { handle: 5 } as PersonItem,
      {},
    );
    expect(harness.mutationService.update).toHaveBeenCalledTimes(1);
    expect(harness.mutationService.create).toHaveBeenCalledTimes(200);
    expect(
      harness.mutationService.schedulePostCommitTasks,
    ).toHaveBeenCalledTimes(1);
  });

  it.each(['2026-07-29T12:00:00Z', '2026-07-30T11:00:00Z'])(
    'rejects an invalid selection before any write: %s',
    async (invalid) => {
      const harness = createHarness(createEvent());
      await expect(
        harness.service.detachOccurrences(
          42,
          {
            occurrenceStarts: ['2026-07-28T11:00:00Z', invalid],
            event: {},
          },
          { handle: 5 } as PersonItem,
          {},
        ),
      ).rejects.toThrow('event.recurrenceOccurrenceInvalid');
      expect(harness.mutationService.update).not.toHaveBeenCalled();
      expect(harness.mutationService.create).not.toHaveBeenCalled();
    },
  );

  it('does not create or schedule deliveries when concurrency or permission validation rejects the master', async () => {
    const harness = createHarness(createEvent());
    jest
      .mocked(harness.mutationService.update)
      .mockRejectedValueOnce(new Error('conflict'));
    await expect(
      harness.service.detachOccurrences(
        42,
        {
          occurrenceStarts: ['2026-07-28T11:00:00Z'],
          event: {},
        },
        { handle: 5 } as PersonItem,
        {},
      ),
    ).rejects.toThrow('conflict');
    expect(harness.mutationService.create).not.toHaveBeenCalled();
    expect(
      harness.mutationService.schedulePostCommitTasks,
    ).not.toHaveBeenCalled();
  });

  it('does not schedule effects when a child create fails inside the transaction', async () => {
    const harness = createHarness(createEvent());
    jest
      .mocked(harness.mutationService.create)
      .mockRejectedValueOnce(new Error('insert denied'));
    await expect(
      harness.service.detachOccurrences(
        42,
        {
          occurrenceStarts: ['2026-07-28T11:00:00Z'],
          event: {},
        },
        { handle: 5 } as PersonItem,
        {},
      ),
    ).rejects.toThrow('insert denied');
    expect(
      harness.mutationService.schedulePostCommitTasks,
    ).not.toHaveBeenCalled();
  });
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
      expect.objectContaining({
        startDate: new Date('2026-07-28T11:00:00.000Z'),
        endDate: new Date('2026-07-28T12:00:00.000Z'),
        recurrenceRule: null,
        recurrenceExceptionDates: [],
      }),
      expect.any(Object),
      [],
      expect.objectContaining({
        suppressNotificationSubscriptions: true,
        calendarDeliveryOperation: 'remove-recurrence',
        postCommitTasks: expect.any(Array),
      }),
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
      expect.objectContaining({
        suppressNotificationSubscriptions: true,
        calendarDeliveryOperation: undefined,
        postCommitTasks: expect.any(Array),
      }),
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

  it('atomically excludes and creates one edited standalone occurrence', async () => {
    const harness = createHarness(createEvent());

    await expect(
      harness.service.detachOccurrence(
        42,
        {
          occurrenceStart: '2026-07-29T11:00:00.000Z',
          expectedUpdatedAt: '2026-07-30T08:00:00.000Z',
          event: {
            title: 'Edited occurrence',
            startDate: '2026-07-29T13:00:00.000Z',
            endDate: '2026-07-29T14:00:00.000Z',
          },
        },
        { handle: 5 } as PersonItem,
        {},
      ),
    ).resolves.toEqual({
      seriesHandle: 42,
      detachedEvent: { handle: 43 },
    });

    expect(harness.mutationService.update).toHaveBeenCalledWith(
      'event',
      42,
      { recurrenceExceptionDates: ['2026-07-29T11:00:00.000Z'] },
      expect.any(Object),
      [],
      expect.objectContaining({
        calendarDeliveryOperation: 'detach-occurrence',
        calendarDeliveryOccurrenceStart: '2026-07-29T11:00:00.000Z',
      }),
      {
        expectedUpdatedAt: '2026-07-30T08:00:00.000Z',
        resolution: 'detect',
      },
      expect.any(Object),
    );
    expect(harness.mutationService.create).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({
        title: 'Edited occurrence',
        startDate: new Date('2026-07-29T13:00:00.000Z'),
        endDate: new Date('2026-07-29T14:00:00.000Z'),
        recurrenceRule: null,
        recurrenceExceptionDates: [],
      }),
      expect.any(Object),
      expect.objectContaining({ calendarDeliveryOperation: undefined }),
      expect.any(Object),
    );
  });

  it('detaches occurrences when legacy exception dates are JSON-serialized', async () => {
    const harness = createHarness(
      createEvent({
        recurrenceExceptionDates:
          '["2026-07-28T11:00:00.000Z"]' as unknown as string[],
      }),
    );

    await expect(
      harness.service.detachOccurrence(
        42,
        {
          occurrenceStart: '2026-07-29T11:00:00.000Z',
          event: {
            title: 'Edited occurrence',
            startDate: '2026-07-29T13:00:00.000Z',
            endDate: '2026-07-29T14:00:00.000Z',
          },
        },
        { handle: 5 } as PersonItem,
        {},
      ),
    ).resolves.toEqual({
      seriesHandle: 42,
      detachedEvent: { handle: 43 },
    });

    expect(harness.mutationService.update).toHaveBeenCalledWith(
      'event',
      42,
      {
        recurrenceExceptionDates: [
          '2026-07-28T11:00:00.000Z',
          '2026-07-29T11:00:00.000Z',
        ],
      },
      expect.any(Object),
      [],
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('atomically detaches multiple occurrences while applying concurrency only once', async () => {
    const harness = createHarness(createEvent());

    await expect(
      harness.service.detachOccurrences(
        42,
        {
          occurrenceStarts: [
            '2026-07-29T11:00:00.000Z',
            '2026-07-28T11:00:00.000Z',
            '2026-07-29T11:00:00.000Z',
          ],
          event: { status: 'completed' },
          expectedUpdatedAt: '2026-07-30T08:00:00.000Z',
        },
        { handle: 5 } as PersonItem,
        {},
      ),
    ).resolves.toEqual({
      seriesHandle: 42,
      seriesEvent: { handle: 42 },
      detachedCount: 2,
      detachedEvents: [{ handle: 43 }, { handle: 43 }],
    });

    expect(harness.em.transactional).toHaveBeenCalledTimes(1);
    expect(harness.mutationService.update).toHaveBeenCalledTimes(1);
    expect(harness.mutationService.update).toHaveBeenCalledWith(
      'event',
      42,
      {
        recurrenceExceptionDates: [
          '2026-07-28T11:00:00.000Z',
          '2026-07-29T11:00:00.000Z',
        ],
      },
      expect.any(Object),
      [],
      expect.objectContaining({
        calendarDeliveryOperation: 'detach-occurrence',
        calendarDeliveryOccurrenceStarts: [
          '2026-07-28T11:00:00.000Z',
          '2026-07-29T11:00:00.000Z',
        ],
      }),
      { expectedUpdatedAt: '2026-07-30T08:00:00.000Z', resolution: 'detect' },
      expect.any(Object),
    );
    expect(harness.mutationService.create).toHaveBeenCalledTimes(2);
    expect(harness.mutationService.create).toHaveBeenNthCalledWith(
      1,
      'event',
      expect.objectContaining({ status: 'completed' }),
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
  });
});
