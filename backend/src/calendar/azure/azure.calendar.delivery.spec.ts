import { describe, expect, it, jest } from '@jest/globals';

import { AzureCalendarService } from './azure.calendar.service';
import { EventItem } from '../../entity/EventItem';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import type {
  AzureDeliveryServiceTestHarness,
  AzureSetEventTestHarness,
} from './azure.calendar.service.spec-support';

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
    const fork = jest.fn(() => emFork);
    const service = new AzureCalendarService({} as never, { fork } as never);
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

    await expect(
      service.deleteSynchronizedEvent(23, 7, emFork as never),
    ).resolves.toBe(true);

    expect(fork).not.toHaveBeenCalled();
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
