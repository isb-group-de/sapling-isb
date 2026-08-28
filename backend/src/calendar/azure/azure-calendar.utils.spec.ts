import { describe, expect, it, jest } from '@jest/globals';

import {
  isAzureNotFoundError,
  normalizeAzureRecurrenceRule,
  resolveAzureOnlineMeetingUrl,
  resolveAzureSeriesImportEvents,
} from './azure-calendar.utils';

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
