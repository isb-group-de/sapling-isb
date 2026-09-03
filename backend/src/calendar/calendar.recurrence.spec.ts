import { describe, expect, it } from '@jest/globals';
import {
  buildAzureRecurrence,
  buildGoogleRecurrence,
  expandFiniteRecurrence,
  findRecurrenceOccurrence,
  hasRecurrenceOccurrenceInRange,
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

  it('adds timed and all-day Google exclusion dates', () => {
    expect(
      buildGoogleRecurrence('FREQ=DAILY;INTERVAL=1;COUNT=3', [
        '2026-05-05T09:30:00.000Z',
      ]),
    ).toEqual([
      'RRULE:FREQ=DAILY;INTERVAL=1;COUNT=3',
      'EXDATE:20260505T093000Z',
    ]);
    expect(
      buildGoogleRecurrence(
        'FREQ=DAILY;INTERVAL=1;COUNT=3',
        ['2026-05-05T00:00:00.000Z'],
        true,
      ),
    ).toContain('EXDATE;VALUE=DATE:20260505');
  });

  it('resolves only exact generated occurrence starts', () => {
    const match = findRecurrenceOccurrence(
      new Date('2026-07-28T11:00:00.000Z'),
      new Date('2026-07-28T12:00:00.000Z'),
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,WE;COUNT=4',
      new Date('2026-08-04T11:00:00.000Z'),
    );

    expect(match).toMatchObject({ occurrenceIndex: 3 });
    expect(match?.endDate.toISOString()).toBe('2026-08-04T12:00:00.000Z');
    expect(
      findRecurrenceOccurrence(
        new Date('2026-07-28T11:00:00.000Z'),
        new Date('2026-07-28T12:00:00.000Z'),
        'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,WE;COUNT=4',
        new Date('2026-08-04T11:30:00.000Z'),
      ),
    ).toBeNull();
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

  it('detects only recurring occurrences that overlap the import window', () => {
    const start = new Date('1960-06-01T09:00:00.000Z');
    const end = new Date('1960-06-01T10:00:00.000Z');
    const rule = 'FREQ=YEARLY;INTERVAL=1';

    expect(
      hasRecurrenceOccurrenceInRange(
        start,
        end,
        rule,
        new Date('2026-06-01T09:30:00.000Z'),
        new Date('2026-06-02T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      hasRecurrenceOccurrenceInRange(
        start,
        end,
        rule,
        new Date('2026-06-02T00:00:00.000Z'),
        new Date('2026-06-08T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
