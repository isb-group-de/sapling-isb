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
} from './azure.calendar.service.spec-support';

describe('AzureCalendarService delivery context', () => {
  it('stores the client time zone in the asynchronous delivery payload', async () => {
    const queueEventDelivery = jest.fn(() => Promise.resolve({ handle: 1 }));
    const service = new AzureCalendarService(
      { queueEventDelivery } as never,
      {} as never,
    );
    const event = { handle: 3 } as EventItem;
    const session = { handle: 8 } as PersonSessionItem;

    await service.queueEvent(
      event,
      session,
      undefined,
      ['startDate'],
      undefined,
      'Europe/Berlin',
    );

    expect(asMock(queueEventDelivery)).toHaveBeenCalledWith(event, {
      provider: 'azure',
      sessionHandle: 8,
      changedFields: ['startDate'],
      timeZone: 'Europe/Berlin',
    });
  });
});

function asMock(value: unknown): jest.Mock {
  return value as jest.Mock;
}

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

  it('keeps a native Outlook exception on its exact Sapling projection', async () => {
    const event = new EventItem();
    event.participants = {
      removeAll: jest.fn(),
      add: jest.fn(),
    } as never;
    const exceptionReference = {
      referenceHandle: 'outlook-exception-id',
      iCalUId: null,
      event,
    } as EventAzureItem;
    const service = createService();

    await expect(
      service.upsertImportedEvent(
        {
          findOne: jest.fn((_entity, where: { referenceHandle?: string }) =>
            Promise.resolve(
              where.referenceHandle === 'outlook-exception-id'
                ? exceptionReference
                : null,
            ),
          ),
          find: jest.fn(() => Promise.resolve([])),
          persist: jest.fn(),
        },
        createGraphEvent({
          id: 'outlook-exception-id',
          iCalUId: 'shared-outlook-series',
          seriesMasterId: 'outlook-master-id',
          type: 'exception',
          subject: 'Edited occurrence',
        }),
        defaults,
      ),
    ).resolves.toBe('updated');

    expect(event.title).toBe('Edited occurrence');
    expect(exceptionReference.iCalUId).toBeNull();
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
