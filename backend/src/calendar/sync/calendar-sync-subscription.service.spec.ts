import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../constants/project.constants', () => ({
  ...jest.requireActual<typeof import('../../constants/project.constants')>(
    '../../constants/project.constants',
  ),
  REDIS_ENABLED: true,
  REDIS_REMOVE_ON_COMPLETE: true,
  REDIS_REMOVE_ON_FAIL: 100,
}));

import {
  CalendarSyncSubscriptionService,
  calculateCalendarSyncRange,
  isCalendarSyncSubscriptionDue,
} from './calendar-sync-subscription.service';
import { CalendarSyncSubscriptionItem } from '../../entity/CalendarSyncSubscriptionItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { PersonItem } from '../../entity/PersonItem';

describe('calendar sync subscription helpers', () => {
  it('registers automatic imports with the BullMQ job scheduler API', async () => {
    const queue = {
      upsertJobScheduler: jest.fn<(...args: unknown[]) => Promise<unknown>>(
        async () => undefined,
      ),
    };
    const service = new CalendarSyncSubscriptionService(
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );

    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'calendar-sync-scheduler',
      { every: 300_000 },
      {
        name: 'schedule-calendar-imports',
        data: {},
        opts: { removeOnComplete: true, removeOnFail: 100 },
      },
    );
  });

  it('calculates the current UTC day range', () => {
    const range = calculateCalendarSyncRange(
      'day',
      new Date('2026-06-03T15:30:00.000Z'),
    );

    expect(range).toEqual({
      startDateTime: new Date('2026-06-03T00:00:00.000Z'),
      endDateTime: new Date('2026-06-04T00:00:00.000Z'),
    });
  });

  it('calculates Monday-first UTC week ranges', () => {
    const range = calculateCalendarSyncRange(
      'week',
      new Date('2026-06-03T15:30:00.000Z'),
    );

    expect(range).toEqual({
      startDateTime: new Date('2026-06-01T00:00:00.000Z'),
      endDateTime: new Date('2026-06-08T00:00:00.000Z'),
    });
  });

  it('calculates the current UTC month range', () => {
    const range = calculateCalendarSyncRange(
      'month',
      new Date('2026-06-15T15:30:00.000Z'),
    );

    expect(range).toEqual({
      startDateTime: new Date('2026-06-01T00:00:00.000Z'),
      endDateTime: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('marks active subscriptions due only after their interval elapsed', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');

    expect(
      isCalendarSyncSubscriptionDue(
        {
          isActive: true,
          intervalMinutes: 60,
          lastRunAt: new Date('2026-06-01T10:59:59.000Z'),
        },
        now,
      ),
    ).toBe(true);

    expect(
      isCalendarSyncSubscriptionDue(
        {
          isActive: true,
          intervalMinutes: 60,
          lastRunAt: new Date('2026-06-01T11:30:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('lets the import service reload the session during automatic imports', async () => {
    const subscription: {
      handle: number;
      isActive: boolean;
      provider: 'azure';
      syncRange: 'week';
      person: {
        handle: number;
        isActive: boolean;
        type: { handle: string };
      };
      lastError?: string | null;
      lastImportedCount?: number;
    } = {
      handle: 7,
      isActive: true,
      provider: 'azure',
      syncRange: 'week',
      person: {
        handle: 3,
        isActive: true,
        type: { handle: 'azure' },
      },
    };
    const em = {
      fork: () => em,
      findOne: jest.fn(() => Promise.resolve(subscription)),
      flush: jest.fn(() => Promise.resolve(undefined)),
    };
    const azureCalendarService = {
      importEvents: jest
        .fn<
          (...args: unknown[]) => Promise<{
            imported: number;
            created: number;
            updated: number;
            skipped: number;
          }>
        >()
        .mockResolvedValue({
          imported: 2,
          created: 1,
          updated: 1,
          skipped: 0,
        }),
    };
    const service = new CalendarSyncSubscriptionService(
      em as never,
      azureCalendarService as never,
      { importEvents: jest.fn() } as never,
      { add: jest.fn() } as never,
    );

    await service.executeSubscriptionImport(7);

    expect(azureCalendarService.importEvents).toHaveBeenCalledWith(
      subscription.person,
      expect.objectContaining({
        startDateTime: expect.any(Date),
        endDateTime: expect.any(Date),
      }),
    );
    expect(subscription.lastError).toBeNull();
    expect(subscription.lastImportedCount).toBe(2);
  });

  it('dispatches automatic Google imports to the Google calendar service', async () => {
    const subscription = {
      handle: 8,
      isActive: true,
      provider: 'google' as const,
      syncRange: 'day' as const,
      person: {
        handle: 4,
        isActive: true,
        type: { handle: 'google' },
      },
      lastError: undefined as string | null | undefined,
      lastImportedCount: undefined as number | undefined,
    };
    const em = {
      fork: () => em,
      findOne: jest.fn(() => Promise.resolve(subscription)),
      flush: jest.fn(() => Promise.resolve(undefined)),
    };
    const googleCalendarService = {
      importEvents: jest
        .fn<
          (...args: unknown[]) => Promise<{
            imported: number;
            created: number;
            updated: number;
            skipped: number;
          }>
        >()
        .mockResolvedValue({
          imported: 3,
          created: 2,
          updated: 1,
          skipped: 0,
        }),
    };
    const service = new CalendarSyncSubscriptionService(
      em as never,
      { importEvents: jest.fn() } as never,
      googleCalendarService as never,
      { add: jest.fn() } as never,
    );

    await service.executeSubscriptionImport(8);

    expect(googleCalendarService.importEvents).toHaveBeenCalledWith(
      subscription.person,
      expect.objectContaining({
        startDateTime: expect.any(Date),
        endDateTime: expect.any(Date),
      }),
    );
    expect(subscription.lastError).toBeNull();
    expect(subscription.lastImportedCount).toBe(3);
  });

  it('stores normalized Outlook availability mappings for the current person', async () => {
    const person = {
      handle: 3,
      isActive: true,
      type: { handle: 'azure' },
      session: { handle: 9 },
    } as unknown as PersonItem;
    const subscription = Object.assign(new CalendarSyncSubscriptionItem(), {
      handle: 7,
      provider: 'azure' as const,
      person,
      defaultEventType: { handle: 'online' },
      defaultEventCategory: { handle: 'internal' },
    });
    const em = {
      fork: () => em,
      findOne: jest.fn((entity: unknown) =>
        Promise.resolve(
          entity === PersonItem
            ? person
            : entity === CalendarSyncSubscriptionItem
              ? subscription
              : null,
        ),
      ),
      find: jest.fn((entity: unknown) => {
        if (entity === EventStatusItem) {
          return Promise.resolve([{ handle: 'scheduled' }]);
        }
        if (entity === EventTypeItem) {
          return Promise.resolve([{ handle: 'onsite' }]);
        }
        if (entity === EventCategoryItem) {
          return Promise.resolve([{ handle: 'customer' }]);
        }
        return Promise.resolve([]);
      }),
      flush: jest.fn(() => Promise.resolve(undefined)),
    };
    const service = new CalendarSyncSubscriptionService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.updateCurrentSubscription(person, {
      outlookAvailabilityMappings: [
        {
          eventStatusHandle: ' scheduled ',
          eventTypeHandle: 'onsite',
          eventCategoryHandle: 'customer',
          showAs: 'workingElsewhere',
        },
      ],
    });

    expect(subscription.outlookAvailabilityMappings).toEqual([
      {
        eventStatusHandle: 'scheduled',
        eventTypeHandle: 'onsite',
        eventCategoryHandle: 'customer',
        showAs: 'workingElsewhere',
      },
    ]);
    expect(result.outlookAvailabilityMappings).toEqual(
      subscription.outlookAvailabilityMappings,
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});
