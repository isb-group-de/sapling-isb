import { describe, expect, it } from '@jest/globals';
import { EventItem } from '../entity/EventItem';
import {
  buildAzureCalendarEvent,
  isAzureAuthenticationError,
  normalizeAzureDateTime,
} from './azure/azure-calendar.utils';
import {
  buildGoogleCalendarEvent,
  isGoogleAuthenticationError,
  normalizeGoogleDateTime,
} from './google/google-calendar.utils';

const createEvent = (): EventItem =>
  ({
    title: 'Planning',
    description: '<p>Agenda</p>',
    startDate: new Date('2026-07-16T08:00:00.000Z'),
    endDate: new Date('2026-07-16T09:00:00.000Z'),
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH',
    participants: [
      { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    ],
    type: { handle: 'meeting' },
  }) as unknown as EventItem;

describe('calendar provider utilities', () => {
  it('builds an Azure event resource', () => {
    expect(buildAzureCalendarEvent(createEvent())).toMatchObject({
      subject: 'Planning',
      body: { contentType: 'HTML', content: '<p>Agenda</p>' },
      attendees: [
        {
          emailAddress: {
            address: 'ada@example.com',
            name: 'Ada Lovelace',
          },
        },
      ],
    });
  });

  it('builds a Google event resource', () => {
    expect(buildGoogleCalendarEvent(createEvent())).toMatchObject({
      summary: 'Planning',
      description: '<p>Agenda</p>',
      attendees: [{ email: 'ada@example.com', displayName: 'Ada Lovelace' }],
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TH'],
    });
  });

  it('normalizes provider date formats', () => {
    expect(normalizeAzureDateTime({ dateTime: '2026-07-16T08:00:00' })).toEqual(
      new Date('2026-07-16T08:00:00.000Z'),
    );
    expect(normalizeGoogleDateTime({ date: '2026-07-16' })).toEqual(
      new Date('2026-07-16T00:00:00.000Z'),
    );
  });

  it('recognizes provider authentication failures', () => {
    expect(isAzureAuthenticationError({ statusCode: 401 })).toBe(true);
    expect(isGoogleAuthenticationError({ code: 403 })).toBe(true);
    expect(isGoogleAuthenticationError({ status: 500 })).toBe(false);
  });
});
