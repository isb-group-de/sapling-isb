import { describe, expect, it, jest } from '@jest/globals';
import { EventItem } from '../../entity/EventItem';
import { CompanyItem } from '../../entity/CompanyItem';
import { CountryItem } from '../../entity/CountryItem';

import {
  buildAzureCalendarEvent,
  buildAzureCalendarEventPatch,
  clampAzureImportRangeToFuture,
  isAzureNotFoundError,
  normalizeAzureRecurrenceRule,
  resolveAzureOnlineMeetingUrl,
  resolveAzureSeriesImportEvents,
} from './azure-calendar.utils';

describe('Azure meeting link creation', () => {
  const event = {
    title: 'Customer appointment',
    description: 'Details',
    startDate: new Date('2026-09-10T09:00:00.000Z'),
    endDate: new Date('2026-09-10T10:00:00.000Z'),
    participants: [],
    type: { handle: 'online' },
    createOnlineMeeting: false,
  } as unknown as EventItem;

  it('does not derive a Teams meeting from the event type', () => {
    expect(buildAzureCalendarEvent(event)).not.toHaveProperty(
      'isOnlineMeeting',
    );
  });

  it('requests a Teams meeting only when the checkbox is enabled', () => {
    const enabled = { ...event, createOnlineMeeting: true } as EventItem;
    expect(buildAzureCalendarEvent(enabled)).toMatchObject({
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    });
    expect(
      buildAzureCalendarEventPatch(enabled, [], ['createOnlineMeeting']),
    ).toEqual({
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    });
  });
});

describe('Azure physical location', () => {
  const company = Object.assign(new CompanyItem(), {
    name: 'Muster GmbH',
    street: 'Musterstraße 1',
    zip: '10115',
    city: 'Berlin',
    country: Object.assign(new CountryItem(), { name: 'Deutschland' }),
  });
  const event = {
    title: 'Customer appointment',
    description: 'Details',
    startDate: new Date('2026-09-10T09:00:00.000Z'),
    endDate: new Date('2026-09-10T10:00:00.000Z'),
    participants: [],
    creatorCompany: company,
    createOnlineMeeting: false,
  } as unknown as EventItem;

  it('sends the customer address as Outlook location', () => {
    expect(buildAzureCalendarEvent(event)).toMatchObject({
      location: {
        displayName: 'Muster GmbH, Musterstraße 1, 10115, Berlin, Deutschland',
      },
    });
  });

  it('updates the Outlook location when the customer changes', () => {
    expect(buildAzureCalendarEventPatch(event, [], ['creatorCompany'])).toEqual(
      {
        location: {
          displayName:
            'Muster GmbH, Musterstraße 1, 10115, Berlin, Deutschland',
        },
      },
    );
  });
});

describe('clampAzureImportRangeToFuture', () => {
  it('removes the elapsed part of an Outlook import window', () => {
    expect(
      clampAzureImportRangeToFuture(
        {
          startDateTime: new Date('2026-06-01T00:00:00.000Z'),
          endDateTime: new Date('2026-06-08T00:00:00.000Z'),
        },
        new Date('2026-06-03T15:30:00.000Z'),
      ),
    ).toEqual({
      startDateTime: new Date('2026-06-03T15:30:00.000Z'),
      endDateTime: new Date('2026-06-08T00:00:00.000Z'),
    });
  });

  it('skips a calendar window that is entirely in the past', () => {
    expect(
      clampAzureImportRangeToFuture(
        {
          startDateTime: new Date('2026-06-01T00:00:00.000Z'),
          endDateTime: new Date('2026-06-02T00:00:00.000Z'),
        },
        new Date('2026-06-03T15:30:00.000Z'),
      ),
    ).toBeNull();
  });
});

describe('resolveAzureSeriesImportEvents', () => {
  it('collapses all calendar-view occurrences into one series master', async () => {
    const loadSeriesMaster = jest.fn(async (seriesMasterId: string) => ({
      id: seriesMasterId,
      type: 'seriesMaster' as const,
      subject: 'Weekly planning',
      recurrence: {
        pattern: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: ['monday'],
        },
        range: { type: 'noEnd' },
      },
    }));

    await expect(
      resolveAzureSeriesImportEvents(
        [
          {
            id: 'occurrence-1',
            type: 'occurrence',
            seriesMasterId: 'series-1',
          },
          {
            id: 'occurrence-2',
            type: 'occurrence',
            seriesMasterId: 'series-1',
          },
          { id: 'single-1', type: 'singleInstance' },
        ],
        loadSeriesMaster,
      ),
    ).resolves.toEqual([
      { id: 'single-1', type: 'singleInstance' },
      {
        id: 'series-1',
        type: 'seriesMaster',
        seriesMasterId: null,
        subject: 'Weekly planning',
        recurrence: {
          pattern: {
            type: 'weekly',
            interval: 1,
            daysOfWeek: ['monday'],
          },
          range: { type: 'noEnd' },
        },
      },
    ]);
    expect(loadSeriesMaster).toHaveBeenCalledTimes(1);
    expect(loadSeriesMaster).toHaveBeenCalledWith('series-1');
  });

  it('skips instances when their master disappeared during the import', async () => {
    await expect(
      resolveAzureSeriesImportEvents(
        [
          {
            id: 'occurrence-1',
            type: 'occurrence',
            seriesMasterId: 'deleted-series',
          },
        ],
        async () => null,
      ),
    ).resolves.toEqual([]);
  });

  it('keeps the first visible occurrence as the import anchor', async () => {
    const results = await resolveAzureSeriesImportEvents(
      [
        {
          id: 'later',
          type: 'occurrence',
          seriesMasterId: 'series-1',
          start: { dateTime: '2026-07-08T09:00:00.000Z' },
          end: { dateTime: '2026-07-08T10:00:00.000Z' },
        },
        {
          id: 'first',
          type: 'occurrence',
          seriesMasterId: 'series-1',
          start: { dateTime: '2026-07-01T09:00:00.000Z' },
          end: { dateTime: '2026-07-01T10:00:00.000Z' },
        },
      ],
      async () => ({
        id: 'series-1',
        type: 'seriesMaster',
        start: { dateTime: '1960-07-01T09:00:00.000Z' },
        end: { dateTime: '1960-07-01T10:00:00.000Z' },
      }),
    );

    expect(results[0]?.saplingImportOccurrence).toEqual({
      start: { dateTime: '2026-07-01T09:00:00.000Z' },
      end: { dateTime: '2026-07-01T10:00:00.000Z' },
    });
  });
});

describe('normalizeAzureRecurrenceRule', () => {
  it('maps a finite Outlook weekly recurrence to Sapling RRULE syntax', () => {
    expect(
      normalizeAzureRecurrenceRule({
        pattern: {
          type: 'weekly',
          interval: 2,
          daysOfWeek: ['monday', 'wednesday'],
        },
        range: { type: 'numbered', numberOfOccurrences: 8 },
      }),
    ).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=8');
  });

  it('maps an Outlook end date without dropping the final day', () => {
    expect(
      normalizeAzureRecurrenceRule({
        pattern: { type: 'daily', interval: 1 },
        range: { type: 'endDate', endDate: '2026-09-30' },
      }),
    ).toBe('FREQ=DAILY;INTERVAL=1;UNTIL=20260930T235959Z');
  });
});

describe('isAzureNotFoundError', () => {
  it.each([
    { statusCode: 404 },
    { response: { status: 404 } },
    { code: 'ErrorItemNotFound' },
    { message: 'The specified object was not found in the store.' },
  ])('recognizes a missing Outlook object from %p', (error) => {
    expect(isAzureNotFoundError(error)).toBe(true);
  });

  it('does not classify unrelated provider failures as missing objects', () => {
    expect(
      isAzureNotFoundError({ statusCode: 429, message: 'Too many requests' }),
    ).toBe(false);
  });
});

describe('resolveAzureOnlineMeetingUrl', () => {
  it('prefers the structured Microsoft Graph join URL', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        onlineMeeting: {
          joinUrl: ' https://teams.microsoft.com/l/meetup-join/structured ',
        },
        onlineMeetingUrl:
          'https://teams.microsoft.com/l/meetup-join/deprecated',
      }),
    ).toBe('https://teams.microsoft.com/l/meetup-join/structured');
  });

  it('falls back to a Teams link in the Outlook HTML body', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        body: {
          contentType: 'html',
          content:
            '<a href="https://teams.microsoft.com/l/meetup-join/abc?context=one&amp;tenant=two">Click here to join the meeting</a>',
        },
      }),
    ).toBe(
      'https://teams.microsoft.com/l/meetup-join/abc?context=one&tenant=two',
    );
  });

  it('unwraps Outlook Safe Links before storing the meeting URL', () => {
    const teamsUrl =
      'https://teams.microsoft.com/l/meetup-join/abc?context=tenant';
    const safeLink = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(teamsUrl)}&data=tracking`;

    expect(
      resolveAzureOnlineMeetingUrl({
        body: { content: `<a href="${safeLink}">Join Microsoft Teams</a>` },
      }),
    ).toBe(teamsUrl);
  });

  it('uses a URL location before inspecting body links', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        locations: [{ locationUri: 'https://conference.example.test/room/42' }],
        body: {
          content:
            '<a href="https://teams.microsoft.com/l/meetup-join/body">Join</a>',
        },
      }),
    ).toBe('https://conference.example.test/room/42');
  });

  it('does not treat an unrelated signature link as a meeting URL', () => {
    expect(
      resolveAzureOnlineMeetingUrl({
        body: {
          content: '<p>Regards</p><a href="https://example.com">Website</a>',
        },
      }),
    ).toBeNull();
  });
});
