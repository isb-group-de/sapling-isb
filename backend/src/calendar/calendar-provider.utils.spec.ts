import { describe, expect, it } from '@jest/globals';
import { EventItem } from '../entity/EventItem';
import {
  buildAzureCalendarEvent,
  buildAzureCalendarEventPatch,
  isAzureAuthenticationError,
  isAzureForbiddenError,
  normalizeAzureDateTime,
} from './azure/azure-calendar.utils';
import {
  buildGoogleCalendarEvent,
  buildGoogleCalendarEventPatch,
  isGoogleAuthenticationError,
  normalizeGoogleDateTime,
} from './google/google-calendar.utils';
import {
  resolveImportedCalendarClassification,
  resolveGoogleCalendarColorId,
} from './calendar-classification.utils';

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
    type: { handle: 'online' },
    category: { handle: 'support' },
  }) as unknown as EventItem;

describe('calendar provider utilities', () => {
  it('builds an Azure event resource', () => {
    expect(
      buildAzureCalendarEvent(createEvent(), [
        { externalValue: 'Online', eventTypeHandle: 'online' },
        { externalValue: 'Support', eventCategoryHandle: 'support' },
      ]),
    ).toMatchObject({
      subject: 'Planning',
      categories: ['Online', 'Support'],
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
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
    expect(
      buildGoogleCalendarEvent(createEvent(), [
        {
          externalValue: '7',
          eventTypeHandle: 'online',
          eventCategoryHandle: 'support',
        },
      ]),
    ).toMatchObject({
      summary: 'Planning',
      colorId: '7',
      extendedProperties: {
        private: {
          saplingEventType: 'online',
          saplingEventCategory: 'support',
        },
      },
      description: '<p>Agenda</p>',
      attendees: [{ email: 'ada@example.com', displayName: 'Ada Lovelace' }],
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TH'],
    });
  });

  it('builds focused category patches without resending attendees', () => {
    expect(
      buildAzureCalendarEventPatch(
        createEvent(),
        [{ externalValue: 'Support', eventCategoryHandle: 'support' }],
        ['category'],
      ),
    ).toEqual({ categories: ['Support'] });

    expect(
      buildGoogleCalendarEventPatch(
        createEvent(),
        [
          {
            externalValue: '7',
            eventTypeHandle: 'online',
            eventCategoryHandle: 'support',
          },
        ],
        ['category'],
      ),
    ).toEqual({
      patch: {
        colorId: '7',
        extendedProperties: {
          private: {
            saplingEventType: 'online',
            saplingEventCategory: 'support',
          },
        },
      },
      sendUpdates: 'none',
    });
  });

  it('builds focused time patches without rewriting attendees', () => {
    expect(
      buildAzureCalendarEventPatch(createEvent(), [], ['startDate', 'endDate']),
    ).toEqual({
      start: {
        dateTime: '2026-07-16T08:00:00.000Z',
        timeZone: 'UTC',
      },
      end: {
        dateTime: '2026-07-16T09:00:00.000Z',
        timeZone: 'UTC',
      },
      recurrence: expect.any(Object),
    });

    const googlePatch = buildGoogleCalendarEventPatch(
      createEvent(),
      [],
      ['startDate', 'endDate'],
    );
    expect(googlePatch.patch).toEqual({
      start: { dateTime: '2026-07-16T08:00:00.000Z' },
      end: { dateTime: '2026-07-16T09:00:00.000Z' },
    });
    expect(googlePatch.patch).not.toHaveProperty('attendees');
    expect(googlePatch.sendUpdates).toBe('all');
  });

  it('maps imported provider values and uses configured defaults', () => {
    expect(
      resolveImportedCalendarClassification({
        externalValues: ['support', 'ONLINE'],
        mappings: [
          { externalValue: 'Online', eventTypeHandle: 'online' },
          { externalValue: 'Support', eventCategoryHandle: 'support' },
        ],
      }),
    ).toEqual({
      eventTypeHandle: 'online',
      eventCategoryHandle: 'support',
    });

    expect(
      resolveImportedCalendarClassification({
        defaults: {
          eventTypeHandle: 'onSite',
          eventCategoryHandle: 'internal',
        },
      }),
    ).toEqual({
      eventTypeHandle: 'onSite',
      eventCategoryHandle: 'internal',
    });

    expect(
      resolveImportedCalendarClassification({
        externalValues: ['7'],
        mappings: [
          {
            externalValue: '7',
            eventTypeHandle: 'online',
            eventCategoryHandle: 'support',
          },
        ],
        embeddedEventTypeHandle: 'review',
        embeddedEventCategoryHandle: 'project',
      }),
    ).toEqual({
      eventTypeHandle: 'review',
      eventCategoryHandle: 'project',
    });
  });

  it('prefers a combined Google color mapping', () => {
    expect(
      resolveGoogleCalendarColorId(createEvent(), [
        { externalValue: '2', eventTypeHandle: 'online' },
        {
          externalValue: '7',
          eventTypeHandle: 'online',
          eventCategoryHandle: 'support',
        },
      ]),
    ).toBe('7');
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
    expect(isAzureForbiddenError({ response: { status: 403 } })).toBe(true);
    expect(isGoogleAuthenticationError({ code: 403 })).toBe(true);
    expect(isGoogleAuthenticationError({ status: 500 })).toBe(false);
  });
});
