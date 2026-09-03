import { describe, expect, it, jest } from '@jest/globals';

import { GoogleCalendarService } from './google.calendar.service';
import { EventGoogleItem } from '../../entity/EventGoogleItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { EventItem } from '../../entity/EventItem';
import { PersonItem } from '../../entity/PersonItem';

type UpsertResult = 'created' | 'updated' | 'skipped';
type GoogleCalendarServiceTestHarness = {
  upsertImportedEvent: (
    emFork: object,
    graphEvent: object,
    defaults: object,
  ) => Promise<UpsertResult>;
  resolveImportedParticipants: (
    emFork: object,
    graphEvent: object,
    user: PersonItem,
  ) => Promise<PersonItem[]>;
  reconcileMissingImportedEvents: (
    emFork: object,
    graphEvents: object[],
    range: { startDateTime: Date; endDateTime: Date },
    user: PersonItem,
    completedStatus: object,
    resolveMissingProviderItem: (
      reference: EventGoogleItem,
    ) => Promise<'missing' | 'updated' | 'unchanged'>,
  ) => Promise<number>;
};
type GoogleSetEventTestHarness = {
  deleteEvent: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
};

type GoogleDeliveryServiceTestHarness = {
  updateEvent: (
    calendar: object,
    event: EventItem,
    reference: EventGoogleItem,
    accessToken: string,
    emFork: object,
    classificationMappings: [],
    operation: 'remove-recurrence' | 'detach-occurrence',
  ) => Promise<unknown>;
};

type GoogleProviderMutationHarness = {
  createEvent: (
    calendar: object,
    event: EventItem,
    accessToken: string,
    emFork: object,
    classificationMappings: [],
  ) => Promise<unknown>;
};

describe('GoogleCalendarService completion synchronization', () => {
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
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await expect(
      service.resolveImportedParticipants(
        emFork,
        {
          attendees: [
            { email: 'ada.lovelace@example.com' },
            { email: 'duplicate@example.com' },
          ],
        },
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

  it('keeps the current user for a personal Google appointment without attendees', async () => {
    const owner = { handle: 7 } as PersonItem;
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await expect(
      service.resolveImportedParticipants(
        { find: jest.fn(() => Promise.resolve([])) },
        { attendees: [] },
        owner,
      ),
    ).resolves.toEqual([owner]);
  });

  it('keeps a completed Google event while canceled events still use deletion', async () => {
    const reference = {
      referenceHandle: 'google-1',
    } as EventGoogleItem;
    const emFork = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValueOnce({
          handle: 42,
          status: { handle: 'completed' },
        })
        .mockResolvedValueOnce(reference),
    };
    const service = new GoogleCalendarService(
      {} as never,
      { fork: () => emFork } as never,
    );
    const harness = service as unknown as GoogleSetEventTestHarness;
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

  it('does not reopen a completed Sapling event during an active Google import', async () => {
    const existingEvent = new EventItem();
    const completedStatus = { handle: 'completed' };
    existingEvent.status = completedStatus as never;
    existingEvent.participants = {
      removeAll: jest.fn(),
      add: jest.fn(),
    } as never;
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
        Promise.resolve({ event: existingEvent }),
      ),
      find: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(() =>
        Promise.resolve([]),
      ),
      persist: jest.fn(),
    };
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await expect(
      service.upsertImportedEvent(
        emFork,
        {
          id: 'google-1',
          summary: 'Planning',
          start: { dateTime: '2026-06-29T09:00:00.000Z' },
          end: { dateTime: '2026-06-29T10:00:00.000Z' },
          attendees: [],
          status: 'confirmed',
        },
        {
          user: { handle: 7, company: { handle: 42 } },
          type: { handle: 'online' },
          category: { handle: 'internal' },
          scheduledStatus: { handle: 'scheduled' },
          canceledStatus: { handle: 'canceled' },
        },
      ),
    ).resolves.toBe('updated');

    expect(existingEvent.status).toBe(completedStatus);
  });
  it('starts an old Google series at its first future occurrence', async () => {
    const persisted: unknown[] = [];
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await expect(
      service.upsertImportedEvent(
        {
          findOne: jest.fn(() => Promise.resolve(null)),
          find: jest.fn(() => Promise.resolve([])),
          persist: jest.fn((item: unknown) => persisted.push(item)),
        },
        {
          id: 'series-master-1',
          summary: 'Birthday',
          start: { dateTime: '2020-06-29T09:00:00.000Z' },
          end: { dateTime: '2020-06-29T10:00:00.000Z' },
          recurrence: ['RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=320'],
          saplingImportOccurrence: {
            start: { dateTime: '2026-06-29T09:00:00.000Z' },
            end: { dateTime: '2026-06-29T10:00:00.000Z' },
          },
        },
        {
          user: { handle: 7, company: { handle: 42 } },
          type: { handle: 'online' },
          category: { handle: 'internal' },
          scheduledStatus: { handle: 'scheduled' },
          canceledStatus: { handle: 'canceled' },
        },
      ),
    ).resolves.toBe('created');

    const event = persisted.find((item) => item instanceof EventItem);
    expect(event?.startDate.toISOString()).toBe('2026-06-29T09:00:00.000Z');
    expect(event?.recurrenceRule).toBe('FREQ=WEEKLY;INTERVAL=1;COUNT=7');
  });

  it('imports a Meet link independently from the event type', async () => {
    const persisted: unknown[] = [];
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await service.upsertImportedEvent(
      {
        findOne: jest.fn(() => Promise.resolve(null)),
        find: jest.fn(() => Promise.resolve([])),
        persist: jest.fn((item: unknown) => persisted.push(item)),
      },
      {
        id: 'google-meet-1',
        summary: 'Planning',
        start: { dateTime: '2026-09-10T09:00:00.000Z' },
        end: { dateTime: '2026-09-10T10:00:00.000Z' },
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
      },
      {
        user: { handle: 7, company: { handle: 42 } },
        type: { handle: 'customer-appointment' },
        category: { handle: 'sales' },
        scheduledStatus: { handle: 'scheduled' },
        canceledStatus: { handle: 'canceled' },
      },
    );

    const event = persisted.find((item) => item instanceof EventItem);
    expect(event?.createOnlineMeeting).toBe(true);
    expect(event?.onlineMeetingURL).toBe(
      'https://meet.google.com/abc-defg-hij',
    );
  });

  it('updates one Sapling event for Google copies with the same iCalUID', async () => {
    const existingEvent = new EventItem();
    existingEvent.participants = {
      removeAll: jest.fn(),
      add: jest.fn(),
    } as never;
    const sharedReference = {
      referenceHandle: 'organizer-calendar-id',
      iCalUId: 'shared-google-uid@example.com',
      event: existingEvent,
    } as EventGoogleItem;
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await expect(
      service.upsertImportedEvent(
        {
          findOne: jest.fn((_entity, where: { iCalUId?: string }) =>
            Promise.resolve(
              where.iCalUId === 'shared-google-uid@example.com'
                ? sharedReference
                : null,
            ),
          ),
          find: jest.fn(() => Promise.resolve([])),
          persist: jest.fn(),
        },
        {
          id: 'attendee-calendar-id',
          iCalUID: 'shared-google-uid@example.com',
          summary: 'Shared planning',
          start: { dateTime: '2026-09-10T09:00:00.000Z' },
          end: { dateTime: '2026-09-10T10:00:00.000Z' },
        },
        {
          user: { handle: 7, company: { handle: 42 } },
          type: { handle: 'online' },
          category: { handle: 'internal' },
          scheduledStatus: { handle: 'scheduled' },
          canceledStatus: { handle: 'canceled' },
        },
      ),
    ).resolves.toBe('updated');

    expect(existingEvent.title).toBe('Shared planning');
    expect(sharedReference.referenceHandle).toBe('organizer-calendar-id');
  });

  it('completes a sole-participant event deleted from Google', async () => {
    const user = { handle: 7 } as PersonItem;
    const participants = [user];
    const completedStatus = { handle: 'completed' };
    const event = {
      startDate: new Date('2026-09-10T09:00:00.000Z'),
      endDate: new Date('2026-09-10T10:00:00.000Z'),
      recurrenceRule: null,
      status: { handle: 'scheduled' },
      participants: {
        getItems: () => participants,
        removeAll: () => participants.splice(0),
        add: (...items: PersonItem[]) => participants.push(...items),
      },
    } as unknown as EventItem;
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleCalendarServiceTestHarness;

    await expect(
      service.reconcileMissingImportedEvents(
        {
          find: jest.fn(() =>
            Promise.resolve([{ referenceHandle: 'deleted-google-id', event }]),
          ),
        },
        [],
        {
          startDateTime: new Date('2026-09-10T08:00:00.000Z'),
          endDateTime: new Date('2026-09-11T00:00:00.000Z'),
        },
        user,
        completedStatus,
        async () => 'missing',
      ),
    ).resolves.toBe(1);
    expect(participants).toEqual([]);
    expect(event.status).toBe(completedStatus);
  });
});

describe('GoogleCalendarService recurrence materialization', () => {
  it('clears the existing series master with one focused update', async () => {
    const patch = jest
      .fn<
        (_request: object) => Promise<{
          data: { id: string; recurrence: never[] };
        }>
      >()
      .mockResolvedValue({ data: { id: 'google-1', recurrence: [] } });
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleDeliveryServiceTestHarness;

    await service.updateEvent(
      { events: { patch } },
      {
        handle: 42,
        title: 'Planning',
        startDate: new Date('2026-07-28T11:00:00.000Z'),
        endDate: new Date('2026-07-28T12:00:00.000Z'),
        isAllDay: false,
        participants: [],
      } as unknown as EventItem,
      { referenceHandle: 'google-1' } as EventGoogleItem,
      'access-token',
      { persist: jest.fn() },
      [],
      'remove-recurrence',
    );

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({
      calendarId: 'primary',
      eventId: 'google-1',
      requestBody: {
        start: { dateTime: '2026-07-28T11:00:00.000Z' },
        end: { dateTime: '2026-07-28T12:00:00.000Z' },
        recurrence: [],
      },
      auth: 'access-token',
    });
  });

  it('patches the series master with the detached occurrence exclusion', async () => {
    const patch = jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
      Promise.resolve({ data: { id: 'google-1' } }),
    );
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleDeliveryServiceTestHarness;
    const event = {
      handle: 42,
      title: 'Planning',
      startDate: new Date('2026-07-28T11:00:00.000Z'),
      endDate: new Date('2026-07-28T12:00:00.000Z'),
      isAllDay: false,
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=3',
      recurrenceExceptionDates: ['2026-07-29T11:00:00.000Z'],
      participants: [],
    } as unknown as EventItem;

    await service.updateEvent(
      { events: { patch } },
      event,
      { referenceHandle: 'google-1' } as EventGoogleItem,
      'access-token',
      { persist: jest.fn() },
      [],
      'detach-occurrence',
    );

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        eventId: 'google-1',
        requestBody: {
          recurrence: [
            'RRULE:FREQ=DAILY;INTERVAL=1;COUNT=3',
            'EXDATE:20260729T110000Z',
          ],
        },
      }),
    );
  });
});

describe('GoogleCalendarService meeting creation', () => {
  it('creates a Meet conference and stores the returned link', async () => {
    const insert = jest.fn<
      (_request: object) => Promise<{
        data: { id: string; iCalUID: string; hangoutLink: string };
      }>
    >(() =>
      Promise.resolve({
        data: {
          id: 'google-1',
          iCalUID: 'google-uid@example.com',
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        },
      }),
    );
    const flush = jest.fn(() => Promise.resolve());
    const persist = jest.fn(() => ({ flush }));
    const event = {
      handle: 42,
      title: 'Planning',
      startDate: new Date('2026-09-10T09:00:00.000Z'),
      endDate: new Date('2026-09-10T10:00:00.000Z'),
      participants: [],
      createOnlineMeeting: true,
    } as unknown as EventItem;
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleProviderMutationHarness;

    await service.createEvent(
      { events: { insert } },
      event,
      'access-token',
      { persist },
      [],
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        auth: 'access-token',
        conferenceDataVersion: 1,
        requestBody: expect.objectContaining({
          conferenceData: {
            createRequest: {
              requestId: 'sapling-event-42',
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      }),
    );
    expect(event.onlineMeetingURL).toBe('https://meet.google.com/abc-defg-hij');
    expect(persist).toHaveBeenCalledTimes(2);
  });
});

describe('GoogleCalendarService physical Event deletion', () => {
  it('deletes the Google projection with the Event owners session', async () => {
    const reference = {
      referenceHandle: 'google-event-23',
    } as EventGoogleItem;
    const session = {
      handle: 82,
      accessToken: 'access-token',
    } as PersonSessionItem;
    const emFork = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>((entity) =>
        Promise.resolve(entity === EventGoogleItem ? reference : session),
      ),
    };
    const service = new GoogleCalendarService(
      {} as never,
      { fork: () => emFork } as never,
    );
    const harness = service as unknown as {
      deleteEvent: jest.Mock;
      resolveGoogleAccessToken: jest.Mock;
    };
    harness.resolveGoogleAccessToken = jest.fn(() =>
      Promise.resolve('access-token'),
    );
    harness.deleteEvent = jest.fn(() => Promise.resolve({ success: true }));

    await expect(service.deleteSynchronizedEvent(23, 7)).resolves.toBe(true);

    expect(emFork.findOne).toHaveBeenNthCalledWith(1, EventGoogleItem, {
      event: 23,
    });
    expect(emFork.findOne).toHaveBeenNthCalledWith(2, PersonSessionItem, {
      person: { handle: 7 },
    });
    expect(harness.deleteEvent).toHaveBeenCalledTimes(1);
    expect(harness.deleteEvent).toHaveBeenCalledWith(
      expect.anything(),
      reference,
      'access-token',
      emFork,
    );
  });
});
