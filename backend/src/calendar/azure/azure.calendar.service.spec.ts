import { describe, expect, it, jest } from '@jest/globals';

import { AzureCalendarService } from './azure.calendar.service';
import { EventItem } from '../../entity/EventItem';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import {
  createGraphEvent,
  createService,
  defaults,
  type AzureDeliveryServiceTestHarness,
  type AzureSetEventTestHarness,
} from './azure.calendar.service.spec-support';

describe('AzureCalendarService Outlook import privacy', () => {
  it('links only unique case-insensitive attendee email matches', async () => {
    const owner = { handle: 7 } as PersonItem;
    const uniqueMatch = {
      handle: 8,
      email: 'Ada.Lovelace@Example.com',
    } as PersonItem;
    const ambiguousMatchA = {
      handle: 9,
      email: 'duplicate@example.com',
    } as PersonItem;
    const ambiguousMatchB = {
      handle: 10,
      email: 'DUPLICATE@example.com',
    } as PersonItem;
    const emFork = {
      find: jest.fn<(...args: unknown[]) => Promise<PersonItem[]>>(() =>
        Promise.resolve([uniqueMatch, ambiguousMatchA, ambiguousMatchB]),
      ),
    };
    const service = createService();

    await expect(
      service.resolveImportedParticipants(
        emFork,
        createGraphEvent({
          attendees: [
            { emailAddress: { address: 'ada.lovelace@example.com' } },
            { emailAddress: { address: 'duplicate@example.com' } },
          ],
        }),
        owner,
      ),
    ).resolves.toEqual([uniqueMatch]);

    expect(emFork.find).toHaveBeenCalledWith(PersonItem, {
      $or: [
        { email: { $ilike: 'ada.lovelace@example.com' } },
        { email: { $ilike: 'duplicate@example.com' } },
      ],
    });
  });

  it('keeps the current user for a personal appointment without attendees', async () => {
    const owner = { handle: 7 } as PersonItem;
    const service = createService();

    await expect(
      service.resolveImportedParticipants(
        { find: jest.fn(() => Promise.resolve([])) },
        createGraphEvent({ attendees: [] }),
        owner,
      ),
    ).resolves.toEqual([owner]);
  });

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
    expect(event?.type).toBe(defaults.type);
    expect(event?.category).toBe(defaults.category);
  });

  it('creates one recurring Sapling event from an Outlook series master', async () => {
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
        createGraphEvent({
          id: 'series-master-1',
          type: 'seriesMaster',
          recurrence: {
            pattern: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: ['monday'],
            },
            range: { type: 'noEnd' },
          },
        }),
        defaults,
      ),
    ).resolves.toBe('created');

    const event = persisted.find((item) => item instanceof EventItem);
    const reference = persisted.find((item) => item instanceof EventAzureItem);
    expect(event?.recurrenceRule).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO');
    expect(reference?.referenceHandle).toBe('series-master-1');
    expect(reference?.iCalUId).toBe('ical-planning-1');
  });

  it('starts an imported old Outlook series at its first future occurrence', async () => {
    const persisted: unknown[] = [];
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
        Promise.resolve(null),
      ),
      find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
        Promise.resolve([]),
      ),
      persist: jest.fn((item: unknown) => persisted.push(item)),
    };
    const service = createService();

    await expect(
      service.upsertImportedEvent(
        emFork,
        createGraphEvent({
          type: 'seriesMaster',
          start: { dateTime: '2020-06-29T09:00:00.000Z' },
          end: { dateTime: '2020-06-29T10:00:00.000Z' },
          recurrence: {
            pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday'] },
            range: { type: 'numbered', numberOfOccurrences: 320 },
          },
          saplingImportOccurrence: {
            start: { dateTime: '2026-06-29T09:00:00.000Z' },
            end: { dateTime: '2026-06-29T10:00:00.000Z' },
          },
        }),
        defaults,
      ),
    ).resolves.toBe('created');

    const event = persisted.find((item) => item instanceof EventItem);
    expect(event?.startDate.toISOString()).toBe('2026-06-29T09:00:00.000Z');
    expect(event?.recurrenceRule).toBe(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=7',
    );
  });

  it('completes a sole-participant event missing from the full Outlook range', async () => {
    const user = { handle: 7 } as PersonItem;
    const completedStatus = { handle: 'completed' } as never;
    const participants = [user];
    const event = {
      handle: 42,
      startDate: new Date('2026-06-29T09:00:00.000Z'),
      endDate: new Date('2026-06-29T10:00:00.000Z'),
      recurrenceRule: null,
      status: { handle: 'scheduled' },
      participants: {
        getItems: () => participants,
        removeAll: () => participants.splice(0),
        add: (...items: PersonItem[]) => participants.push(...items),
      },
    } as unknown as EventItem;
    const service = createService();

    await expect(
      service.reconcileMissingImportedEvents(
        {
          find: jest.fn(() =>
            Promise.resolve([
              {
                referenceHandle: 'missing-outlook-id',
                iCalUId: 'missing-ical-id',
                event,
              },
            ]),
          ),
        },
        [],
        {
          startDateTime: new Date('2026-06-29T08:00:00.000Z'),
          endDateTime: new Date('2026-06-30T00:00:00.000Z'),
        },
        user,
        completedStatus,
        async () => 'missing',
      ),
    ).resolves.toBe(1);

    expect(participants).toEqual([]);
    expect(event.status).toBe(completedStatus);
  });

  it('keeps an absent range item active when Outlook confirms it still exists', async () => {
    const user = { handle: 7 } as PersonItem;
    const scheduledStatus = { handle: 'scheduled' } as never;
    const event = {
      handle: 42,
      startDate: new Date('2026-06-29T09:00:00.000Z'),
      endDate: new Date('2026-06-29T10:00:00.000Z'),
      recurrenceRule: null,
      status: scheduledStatus,
      participants: { getItems: () => [user] },
    } as unknown as EventItem;
    const service = createService();

    await expect(
      service.reconcileMissingImportedEvents(
        {
          find: jest.fn(() =>
            Promise.resolve([{ referenceHandle: 'moved-outlook-id', event }]),
          ),
        },
        [],
        {
          startDateTime: new Date('2026-06-29T08:00:00.000Z'),
          endDateTime: new Date('2026-06-30T00:00:00.000Z'),
        },
        user,
        { handle: 'completed' } as never,
        async () => 'unchanged',
      ),
    ).resolves.toBe(0);

    expect(event.status).toBe(scheduledStatus);
  });

  it('updates one Sapling event for mailbox-specific ids of the same Outlook meeting', async () => {
    const existingEvent = new EventItem();
    existingEvent.title = 'Old title';
    const sharedReference = {
      referenceHandle: 'organizer-mailbox-id',
      iCalUId: 'shared-meeting-uid',
      event: existingEvent,
    } as EventAzureItem;
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(
        (_entity, where) =>
          Promise.resolve(
            (where as { iCalUId?: string }).iCalUId === 'shared-meeting-uid'
              ? sharedReference
              : null,
          ),
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
        createGraphEvent({
          id: 'attendee-mailbox-id',
          iCalUId: 'shared-meeting-uid',
          subject: 'Shared planning',
        }),
        defaults,
      ),
    ).resolves.toBe('updated');

    expect(existingEvent.title).toBe('Shared planning');
    expect(existingEvent.startDate.toISOString()).toBe(
      '2026-06-29T09:00:00.000Z',
    );
    expect(existingEvent.endDate.toISOString()).toBe(
      '2026-06-29T10:00:00.000Z',
    );
    expect(sharedReference.referenceHandle).toBe('organizer-mailbox-id');
    expect(emFork.persist).not.toHaveBeenCalled();
  });

  it('backfills the calendar-wide id on a legacy mailbox reference', async () => {
    const existingEvent = new EventItem();
    const legacyReference = {
      referenceHandle: 'outlook-1',
      event: existingEvent,
    } as EventAzureItem;
    const emFork = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(legacyReference),
      find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
        Promise.resolve([]),
      ),
      persist: jest.fn(),
    };
    const service = createService();

    await expect(
      service.upsertImportedEvent(emFork, createGraphEvent(), defaults),
    ).resolves.toBe('updated');

    expect(legacyReference.iCalUId).toBe('ical-planning-1');
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

  it('updates provider fields without overwriting an existing Sapling classification', async () => {
    const existingEvent = new EventItem();
    existingEvent.title = 'Old title';
    existingEvent.isPrivate = false;
    const existingType = { handle: 'customer-appointment' };
    const existingCategory = { handle: 'sales' };
    existingEvent.type = existingType as never;
    existingEvent.category = existingCategory as never;
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
    expect(existingEvent.type).toBe(existingType);
    expect(existingEvent.category).toBe(existingCategory);
    expect(emFork.persist).not.toHaveBeenCalled();
  });

  it('does not reopen a completed Sapling event during an active Outlook import', async () => {
    const existingEvent = new EventItem();
    const completedStatus = { handle: 'completed' };
    existingEvent.status = completedStatus as never;
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
        Promise.resolve({ event: existingEvent }),
      ),
      find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
        Promise.resolve([]),
      ),
      persist: jest.fn(),
    };
    const service = createService();

    await expect(
      service.upsertImportedEvent(emFork, createGraphEvent(), defaults),
    ).resolves.toBe('updated');

    expect(existingEvent.status).toBe(completedStatus);
  });
});

describe('AzureCalendarService completion delivery', () => {
  it('loads a moved Outlook event completely and distinguishes deletion', async () => {
    const get = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce({
        id: 'existing',
        subject: 'Moved appointment',
        start: { dateTime: '2026-07-06T09:00:00.000Z' },
        end: { dateTime: '2026-07-06T10:00:00.000Z' },
      })
      .mockRejectedValueOnce({ statusCode: 404 });
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureDeliveryServiceTestHarness;
    (service as unknown as { createClient: () => unknown }).createClient =
      jest.fn(() => ({
        api: () => ({ query: () => ({ header: () => ({ get }) }) }),
      }));

    await expect(
      service.fetchAzureEventByReference(
        'access-token',
        'existing',
        new Date('2026-06-29T08:00:00.000Z'),
      ),
    ).resolves.toMatchObject({
      subject: 'Moved appointment',
      start: { dateTime: '2026-07-06T09:00:00.000Z' },
    });
    await expect(
      service.fetchAzureEventByReference(
        'access-token',
        'deleted',
        new Date('2026-06-29T08:00:00.000Z'),
      ),
    ).resolves.toBeNull();
  });

  it('anchors a moved Outlook series at its next future instance', async () => {
    const masterGet = jest.fn(() =>
      Promise.resolve({
        id: 'series-1',
        type: 'seriesMaster',
        start: { dateTime: '2020-06-29T09:00:00.000Z' },
        end: { dateTime: '2020-06-29T10:00:00.000Z' },
        recurrence: {
          pattern: { type: 'weekly', interval: 1 },
          range: { type: 'noEnd' },
        },
      }),
    );
    const instancesGet = jest.fn(() =>
      Promise.resolve({
        value: [
          {
            id: 'occurrence-1',
            type: 'occurrence',
            start: { dateTime: '2026-07-13T09:00:00.000Z' },
            end: { dateTime: '2026-07-13T10:00:00.000Z' },
          },
        ],
      }),
    );
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureDeliveryServiceTestHarness;
    (service as unknown as { createClient: () => unknown }).createClient =
      jest.fn(() => ({
        api: (path: string) => ({
          query: () => ({
            header: () => ({
              get: path.endsWith('/instances') ? instancesGet : masterGet,
            }),
          }),
        }),
      }));

    await expect(
      service.fetchAzureEventByReference(
        'access-token',
        'series-1',
        new Date('2026-07-06T00:00:00.000Z'),
      ),
    ).resolves.toMatchObject({
      id: 'series-1',
      saplingImportOccurrence: {
        start: { dateTime: '2026-07-13T09:00:00.000Z' },
        end: { dateTime: '2026-07-13T10:00:00.000Z' },
      },
    });
  });

  it('stores the calendar-wide id returned for a Sapling-created Outlook event', async () => {
    const post = jest.fn(() =>
      Promise.resolve({
        id: 'organizer-mailbox-id',
        iCalUId: 'shared-meeting-uid',
        onlineMeeting: null,
      }),
    );
    const api = jest.fn(() => ({ post }));
    const flush = jest.fn(() => Promise.resolve());
    const persisted: unknown[] = [];
    const emFork = {
      persist: jest.fn((item: unknown) => {
        persisted.push(item);
        return { flush };
      }),
    };
    const event = {
      title: 'Planning',
      description: 'Details',
      startDate: new Date('2026-06-29T09:00:00.000Z'),
      endDate: new Date('2026-06-29T10:00:00.000Z'),
      participants: [],
      type: { handle: 'appointment' },
    } as unknown as EventItem;
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureDeliveryServiceTestHarness;

    await expect(
      service.createEvent({ api }, event, emFork, []),
    ).resolves.toEqual({
      id: 'organizer-mailbox-id',
      iCalUId: 'shared-meeting-uid',
      onlineMeeting: null,
    });

    const reference = persisted.find((item) => item instanceof EventAzureItem);
    expect(reference?.referenceHandle).toBe('organizer-mailbox-id');
    expect(reference?.iCalUId).toBe('shared-meeting-uid');
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('keeps a completed Outlook event while canceled events still use deletion', async () => {
    const reference = {
      referenceHandle: 'outlook-1',
    } as EventAzureItem;
    const emFork = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValueOnce({
          handle: 42,
          status: { handle: 'completed' },
        })
        .mockResolvedValueOnce(reference),
    };
    const service = new AzureCalendarService(
      {} as never,
      { fork: () => emFork } as never,
    );
    const harness = service as unknown as AzureSetEventTestHarness;
    harness.deleteEvent = jest.fn(() => Promise.resolve({ success: true }));

    await expect(service.setEvent(42, 'access-token')).resolves.toBeNull();
    expect(harness.deleteEvent).not.toHaveBeenCalled();

    emFork.findOne
      .mockResolvedValueOnce({
        handle: 42,
        status: { handle: 'canceled' },
      })
      .mockResolvedValueOnce(reference);

    await expect(service.setEvent(42, 'access-token')).resolves.toEqual({
      success: true,
    });
    expect(harness.deleteEvent).toHaveBeenCalledTimes(1);
  });

  it('treats an already missing Outlook event as a successful deletion', async () => {
    const reference = {
      referenceHandle: 'deleted-outlook-event',
    } as EventAzureItem;
    const removeFromOutlook = jest.fn(() =>
      Promise.reject(
        Object.assign(
          new Error('The specified object was not found in the store.'),
          {
            statusCode: 404,
            code: 'ErrorItemNotFound',
          },
        ),
      ),
    );
    const client = {
      api: jest.fn((path: string) => {
        void path;
        return { delete: removeFromOutlook };
      }),
    };
    const flush = jest.fn(() => Promise.resolve());
    const remove = jest.fn((removedReference: EventAzureItem) => {
      void removedReference;
      return { flush };
    });
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureSetEventTestHarness;

    await expect(
      service.deleteEvent(client, reference, { remove }),
    ).resolves.toEqual({ success: true });

    expect(client.api).toHaveBeenCalledWith('/me/events/deleted-outlook-event');
    expect(removeFromOutlook).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls).toHaveLength(1);
    expect(remove.mock.calls[0]?.[0]).toBe(reference);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('keeps the Outlook reference when deletion fails unexpectedly', async () => {
    const reference = {
      referenceHandle: 'outlook-event',
    } as EventAzureItem;
    const providerError = Object.assign(new Error('Microsoft Graph failed'), {
      statusCode: 500,
      code: 'InternalServerError',
    });
    const client = {
      api: jest.fn(() => ({
        delete: jest.fn(() => Promise.reject(providerError)),
      })),
    };
    const remove = jest.fn();
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureSetEventTestHarness;

    await expect(
      service.deleteEvent(client, reference, { remove }),
    ).rejects.toBe(providerError);

    expect(remove).not.toHaveBeenCalled();
  });

  it('recreates an active recurring event when its Outlook master no longer exists', async () => {
    const event = {
      handle: 42,
      status: { handle: 'scheduled' },
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
    } as EventItem;
    const reference = {
      referenceHandle: 'deleted-outlook-event',
    } as EventAzureItem;
    const flush = jest.fn(() => Promise.resolve());
    const remove = jest.fn((removedReference: EventAzureItem) => {
      void removedReference;
      return { flush };
    });
    const emFork = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce(reference),
      remove,
    };
    const service = new AzureCalendarService(
      {} as never,
      { fork: () => emFork } as never,
    );
    const harness = service as unknown as AzureSetEventTestHarness;
    harness.updateEvent = jest.fn(() =>
      Promise.reject(
        Object.assign(
          new Error('The specified object was not found in the store.'),
          {
            statusCode: 404,
            code: 'ErrorItemNotFound',
          },
        ),
      ),
    );
    harness.createEvent = jest.fn(() =>
      Promise.resolve({ id: 'replacement-outlook-event' }),
    );

    await expect(service.setEvent(42, 'access-token')).resolves.toEqual({
      id: 'replacement-outlook-event',
    });

    expect(harness.updateEvent).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls).toHaveLength(1);
    expect(remove.mock.calls[0]?.[0]).toBe(reference);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(harness.createEvent).toHaveBeenCalledTimes(1);
  });
});

describe('AzureCalendarService physical Event deletion', () => {
  it('deletes the Outlook projection with the Event owners session', async () => {
    const reference = {
      referenceHandle: 'outlook-event-23',
    } as EventAzureItem;
    const session = {
      handle: 81,
      accessToken: 'access-token',
    } as PersonSessionItem;
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>((entity) =>
        Promise.resolve(entity === EventAzureItem ? reference : session),
      ),
    };
    const service = new AzureCalendarService(
      {} as never,
      { fork: () => emFork } as never,
    );
    const harness = service as unknown as {
      createClient: jest.Mock;
      deleteEvent: jest.Mock;
      resolveAzureAccessToken: jest.Mock;
    };
    const client = { provider: 'azure' };
    harness.createClient = jest.fn(() => client);
    harness.resolveAzureAccessToken = jest.fn(() =>
      Promise.resolve('access-token'),
    );
    harness.deleteEvent = jest.fn(() => Promise.resolve({ success: true }));

    await expect(service.deleteSynchronizedEvent(23, 7)).resolves.toBe(true);

    expect(emFork.findOne).toHaveBeenNthCalledWith(1, EventAzureItem, {
      event: 23,
    });
    expect(emFork.findOne).toHaveBeenNthCalledWith(2, PersonSessionItem, {
      person: { handle: 7 },
    });
    expect(harness.deleteEvent).toHaveBeenCalledTimes(1);
    expect(harness.deleteEvent).toHaveBeenCalledWith(client, reference, emFork);
  });
});
