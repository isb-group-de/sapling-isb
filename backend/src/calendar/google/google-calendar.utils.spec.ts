import { describe, expect, it, jest } from '@jest/globals';
import { EventItem } from '../../entity/EventItem';
import {
  buildGoogleCalendarEvent,
  clampGoogleImportRangeToFuture,
  normalizeGoogleRecurrence,
  resolveGoogleSeriesImportEvents,
} from './google-calendar.utils';

describe('google-calendar.utils', () => {
  it('removes the elapsed part of a Google import window', () => {
    expect(
      clampGoogleImportRangeToFuture(
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

  it('collapses expanded recurring instances to one loaded series master', async () => {
    const loadMaster = jest.fn(async (id: string) => ({
      id,
      summary: 'Series master',
      recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
    }));

    await expect(
      resolveGoogleSeriesImportEvents(
        [
          { id: 'single-1', summary: 'Single' },
          { id: 'instance-1', recurringEventId: 'master-1' },
          { id: 'instance-2', recurringEventId: 'master-1' },
        ],
        loadMaster,
      ),
    ).resolves.toEqual([
      { id: 'single-1', summary: 'Single' },
      {
        id: 'master-1',
        summary: 'Series master',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
      },
    ]);
    expect(loadMaster).toHaveBeenCalledTimes(1);
  });

  it('keeps the first expanded instance as a future series anchor', async () => {
    const results = await resolveGoogleSeriesImportEvents(
      [
        {
          id: 'later',
          recurringEventId: 'master-1',
          start: { dateTime: '2026-07-08T09:00:00.000Z' },
          end: { dateTime: '2026-07-08T10:00:00.000Z' },
        },
        {
          id: 'first',
          recurringEventId: 'master-1',
          start: { dateTime: '2026-07-01T09:00:00.000Z' },
          end: { dateTime: '2026-07-01T10:00:00.000Z' },
        },
      ],
      async () => ({
        id: 'master-1',
        start: { dateTime: '2020-07-01T09:00:00.000Z' },
        end: { dateTime: '2020-07-01T10:00:00.000Z' },
        recurrence: ['RRULE:FREQ=WEEKLY'],
      }),
    );

    expect(results[0]?.saplingImportOccurrence).toEqual({
      start: { dateTime: '2026-07-01T09:00:00.000Z' },
      end: { dateTime: '2026-07-01T10:00:00.000Z' },
    });
  });

  it('requests Google Meet only when enabled and given a unique request id', () => {
    const baseEvent = {
      title: 'Planning',
      startDate: new Date('2026-09-10T09:00:00.000Z'),
      endDate: new Date('2026-09-10T10:00:00.000Z'),
      participants: [],
      createOnlineMeeting: false,
    } as unknown as EventItem;
    expect(buildGoogleCalendarEvent(baseEvent)).not.toHaveProperty(
      'conferenceData',
    );
    expect(
      buildGoogleCalendarEvent(
        { ...baseEvent, createOnlineMeeting: true } as unknown as EventItem,
        [],
        'sapling-request-1',
      ),
    ).toMatchObject({
      conferenceData: {
        createRequest: {
          requestId: 'sapling-request-1',
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    });
  });

  it('normalizes RRULE and EXDATE lines from a Google series master', () => {
    expect(
      normalizeGoogleRecurrence([
        'RRULE:FREQ=DAILY;COUNT=3',
        'EXDATE:20260729T110000Z',
      ]),
    ).toEqual({
      recurrenceRule: 'FREQ=DAILY;COUNT=3',
      exceptionDates: ['2026-07-29T11:00:00.000Z'],
    });
  });
});
