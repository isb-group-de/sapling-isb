import { describe, expect, it } from '@jest/globals';
import {
  buildAzureRecurrence,
  buildGoogleRecurrence,
  expandFiniteRecurrence,
  parseRecurrenceRule,
} from './calendar.recurrence';

describe('calendar.recurrence', () => {
  it('parses weekly recurrence rules with interval, weekdays, and count', () => {
    const parsed = parseRecurrenceRule(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=8',
    );

    expect(parsed).toEqual({
      raw: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=8',
      frequency: 'WEEKLY',
      interval: 2,
      byDay: ['MO', 'WE', 'FR'],
      count: 8,
    });
  });

  it('builds the Google recurrence payload from a stored RRULE', () => {
    expect(
      buildGoogleRecurrence('RRULE:FREQ=MONTHLY;INTERVAL=1;COUNT=3'),
    ).toEqual(['RRULE:FREQ=MONTHLY;INTERVAL=1;COUNT=3']);
  });

  it('maps weekly recurrence rules to a Microsoft Graph recurrence payload', () => {
    const recurrence = buildAzureRecurrence(
      new Date('2026-05-04T09:30:00.000Z'),
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;UNTIL=20260630T093000Z',
    );

    expect(recurrence).toEqual({
      pattern: {
        type: 'weekly',
        interval: 1,
        daysOfWeek: ['monday', 'wednesday'],
        firstDayOfWeek: 'monday',
      },
      range: {
        type: 'endDate',
        startDate: '2026-05-04',
        endDate: '2026-06-30',
        recurrenceTimeZone: 'UTC',
      },
    });
  });

  it('expands a finite multi-day weekly recurrence for materialization', () => {
    const result = expandFiniteRecurrence(
      new Date('2026-07-28T11:00:00.000Z'),
      new Date('2026-07-28T12:00:00.000Z'),
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,WE;COUNT=4',
    );

    expect(result).toMatchObject({ isFinite: true, isComplete: true });
    expect(
      result.occurrences.map((occurrence) =>
        occurrence.startDate.toISOString(),
      ),
    ).toEqual([
      '2026-07-28T11:00:00.000Z',
      '2026-07-29T11:00:00.000Z',
      '2026-08-04T11:00:00.000Z',
      '2026-08-05T11:00:00.000Z',
    ]);
  });

  it('refuses to represent an open-ended or over-limit series as complete', () => {
    expect(
      expandFiniteRecurrence(
        new Date('2026-07-28T11:00:00.000Z'),
        new Date('2026-07-28T12:00:00.000Z'),
        'FREQ=DAILY;INTERVAL=1',
      ),
    ).toEqual({ occurrences: [], isFinite: false, isComplete: false });

    const overLimit = expandFiniteRecurrence(
      new Date('2026-07-28T11:00:00.000Z'),
      new Date('2026-07-28T12:00:00.000Z'),
      'FREQ=DAILY;INTERVAL=1;COUNT=101',
    );
    expect(overLimit.occurrences).toHaveLength(100);
    expect(overLimit.isComplete).toBe(false);
  });
});
