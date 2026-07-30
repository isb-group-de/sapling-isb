import { describe, expect, it, jest } from '@jest/globals';

import { AzureCalendarService } from './azure.calendar.service';
import { EventItem } from '../../entity/EventItem';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { PersonItem } from '../../entity/PersonItem';

type UpsertResult = 'created' | 'updated' | 'skipped';
type AzureCalendarServiceTestHarness = {
  upsertImportedEvent: (
    emFork: object,
    graphEvent: object,
    defaults: object,
  ) => Promise<UpsertResult>;
};
type AzureCategoryServiceTestHarness = {
  resolveAzureAccessToken: jest.MockedFunction<
    (...args: unknown[]) => Promise<string | null>
  >;
  fetchMasterCategoriesWithRetry: jest.MockedFunction<
    (
      ...args: unknown[]
    ) => Promise<Array<{ id?: string; displayName?: string; color?: string }>>
  >;
};
type AzureDeliveryServiceTestHarness = {
  updateEvent: (
    client: object,
    event: EventItem,
    reference: EventAzureItem,
    emFork: object,
    classificationMappings: [],
    operation: 'remove-recurrence',
  ) => Promise<unknown>;
};

const defaults = {
  user: {
    handle: 7,
    company: { handle: 42 },
  },
  type: { handle: 'online' },
  category: { handle: 'internal' },
  scheduledStatus: { handle: 'scheduled' },
  canceledStatus: { handle: 'canceled' },
};

function createGraphEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outlook-1',
    subject: 'Planning',
    bodyPreview: 'Details',
    start: { dateTime: '2026-06-29T09:00:00.000Z' },
    end: { dateTime: '2026-06-29T10:00:00.000Z' },
    isAllDay: false,
    isCancelled: false,
    attendees: [],
    ...overrides,
  };
}

function createService(): AzureCalendarServiceTestHarness {
  return new AzureCalendarService(
    {} as never,
    {} as never,
  ) as unknown as AzureCalendarServiceTestHarness;
}

describe('AzureCalendarService Outlook import privacy', () => {
  it('imports private Outlook sensitivity as a private Sapling event', async () => {
    const persisted: unknown[] = [];
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
        Promise.resolve(null),
      ),
      find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
        Promise.resolve([]),
      ),
      persist: jest.fn((item: unknown) => {
        persisted.push(item);
      }),
    };
    const service = createService();

    await expect(
      service.upsertImportedEvent(
        emFork,
        createGraphEvent({ sensitivity: 'private' }),
        defaults,
      ),
    ).resolves.toBe('created');

    const event = persisted.find((item) => item instanceof EventItem);
    expect(event?.isPrivate).toBe(true);
    expect(event?.title).toBe('Planning');
    expect(event?.description).toBe('Details');
  });

  it('imports non-private, missing, and unknown Outlook sensitivity as public events', async () => {
    const service = createService();

    for (const sensitivity of ['normal', undefined, 'confidential']) {
      const persisted: unknown[] = [];
      const emFork = {
        findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
          Promise.resolve(null),
        ),
        find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
          Promise.resolve([]),
        ),
        persist: jest.fn((item: unknown) => {
          persisted.push(item);
        }),
      };

      await expect(
        service.upsertImportedEvent(
          emFork,
          createGraphEvent({
            id: `outlook-${String(sensitivity)}`,
            sensitivity,
          }),
          defaults,
        ),
      ).resolves.toBe('created');

      const event = persisted.find((item) => item instanceof EventItem);
      expect(event?.isPrivate).toBe(false);
    }
  });

  it('updates an existing Outlook-linked event when privacy changes', async () => {
    const existingEvent = new EventItem();
    existingEvent.title = 'Old title';
    existingEvent.isPrivate = false;
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
        Promise.resolve({
          event: existingEvent,
        }),
      ),
      find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
        Promise.resolve([]),
      ),
      persist: jest.fn(),
    };
    const service = createService();

    await expect(
      service.upsertImportedEvent(
        emFork,
        createGraphEvent({ sensitivity: 'private' }),
        defaults,
      ),
    ).resolves.toBe('updated');

    expect(existingEvent.isPrivate).toBe(true);
    expect(existingEvent.title).toBe('Planning');
    expect(emFork.persist).not.toHaveBeenCalled();
  });
});

describe('AzureCalendarService Outlook master categories', () => {
  it('loads, normalizes, and sorts the current user categories', async () => {
    const session = { handle: 5 };
    const em = {
      fork: () => em,
      findOne: jest.fn(() => Promise.resolve(session)),
    };
    const service = new AzureCalendarService({} as never, em as never);
    const harness = service as unknown as AzureCategoryServiceTestHarness;
    harness.resolveAzureAccessToken = jest.fn(() =>
      Promise.resolve('access-token'),
    );
    harness.fetchMasterCategoriesWithRetry = jest.fn(() =>
      Promise.resolve([
        { id: '2', displayName: ' Vertrieb ', color: ' preset7 ' },
        { id: '1', displayName: 'Projekt', color: 'preset4' },
        { id: '3', displayName: ' ' },
      ]),
    );

    await expect(
      service.getMasterCategories({
        handle: 7,
        type: { handle: 'azure' },
      } as unknown as PersonItem),
    ).resolves.toEqual([
      { id: '1', displayName: 'Projekt', color: 'preset4' },
      { id: '2', displayName: 'Vertrieb', color: 'preset7' },
    ]);
    expect(harness.fetchMasterCategoriesWithRetry).toHaveBeenCalledWith(
      session,
      'access-token',
    );
  });
});

describe('AzureCalendarService recurrence materialization', () => {
  it('clears the existing series master with one focused update', async () => {
    const patch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce({ id: 'outlook-1', recurrence: null });
    const api = jest.fn((_path: string) => ({ patch }));
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureDeliveryServiceTestHarness;
    const event = {
      handle: 42,
      title: 'Planning',
      startDate: new Date('2026-07-28T11:00:00.000Z'),
      endDate: new Date('2026-07-28T12:00:00.000Z'),
      recurrenceRule: null,
      participants: [],
      type: { handle: 'appointment' },
    } as unknown as EventItem;
    const reference = {
      referenceHandle: 'outlook-1',
    } as EventAzureItem;

    await service.updateEvent(
      { api },
      event,
      reference,
      { persist: jest.fn(), flush: jest.fn() },
      [],
      'remove-recurrence',
    );

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenNthCalledWith(1, '/me/events/outlook-1');
    expect(patch).toHaveBeenNthCalledWith(1, { recurrence: null });
  });
});
