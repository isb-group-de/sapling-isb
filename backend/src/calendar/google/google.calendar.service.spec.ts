import { describe, expect, it, jest } from '@jest/globals';

import { GoogleCalendarService } from './google.calendar.service';
import { EventGoogleItem } from '../../entity/EventGoogleItem';
import { EventItem } from '../../entity/EventItem';

type UpsertResult = 'created' | 'updated' | 'skipped';
type GoogleCalendarServiceTestHarness = {
  upsertImportedEvent: (
    emFork: object,
    graphEvent: object,
    defaults: object,
  ) => Promise<UpsertResult>;
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
    classificationMappings: [],
    operation: 'remove-recurrence',
  ) => Promise<unknown>;
};

describe('GoogleCalendarService completion synchronization', () => {
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
});

describe('GoogleCalendarService recurrence materialization', () => {
  it('clears the existing series master with one focused update', async () => {
    const patch = jest.fn((_request: object) =>
      Promise.resolve({ data: { id: 'google-1', recurrence: [] } }),
    );
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleDeliveryServiceTestHarness;

    await service.updateEvent(
      { events: { patch } },
      { handle: 42 } as EventItem,
      { referenceHandle: 'google-1' } as EventGoogleItem,
      'access-token',
      [],
      'remove-recurrence',
    );

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({
      calendarId: 'primary',
      eventId: 'google-1',
      requestBody: { recurrence: [] },
      auth: 'access-token',
    });
  });
});
