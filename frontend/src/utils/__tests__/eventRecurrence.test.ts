import { describe, expect, it, vi } from 'vitest'
import {
  buildRecurrenceRule,
  expandRecurringEvent,
  getRecurrenceEndDate,
  parseRecurrenceRule,
  RECURRENCE_MAX_OCCURRENCES,
} from '../eventRecurrence'

describe('eventRecurrence', () => {
  it('builds weekly RRULE strings with weekdays and count', () => {
    expect(
      buildRecurrenceRule({
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MO', 'WE'],
        endMode: 'count',
        count: 8,
        startDate: '2026-05-04',
        startTime: '09:30',
      }),
    ).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;COUNT=8')
  })

  it('normalizes zero or empty count values to COUNT=1', () => {
    expect(
      buildRecurrenceRule({
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MO'],
        endMode: 'count',
        count: 0,
        startDate: '2026-05-04',
      }),
    ).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=1')

    expect(
      buildRecurrenceRule({
        frequency: 'MONTHLY',
        interval: 1,
        endMode: 'count',
        count: null,
        startDate: '2026-05-04',
      }),
    ).toBe('FREQ=MONTHLY;INTERVAL=1;COUNT=1')
  })

  it('caps count based recurrences at the product limit', () => {
    expect(
      buildRecurrenceRule({
        frequency: 'DAILY',
        interval: 1,
        endMode: 'count',
        count: RECURRENCE_MAX_OCCURRENCES + 1,
        startDate: '2026-05-04',
      }),
    ).toBe(`FREQ=DAILY;INTERVAL=1;COUNT=${RECURRENCE_MAX_OCCURRENCES}`)

    expect(parseRecurrenceRule('FREQ=DAILY;INTERVAL=1;COUNT=4000')?.count).toBe(
      RECURRENCE_MAX_OCCURRENCES,
    )
  })

  it('parses stored RRULE strings', () => {
    expect(parseRecurrenceRule('RRULE:FREQ=MONTHLY;INTERVAL=1;COUNT=6')).toEqual({
      raw: 'FREQ=MONTHLY;INTERVAL=1;COUNT=6',
      frequency: 'MONTHLY',
      interval: 1,
      byDay: [],
      count: 6,
    })
  })

  it('expands recurring events into occurrences inside the visible range', () => {
    const occurrences = expandRecurringEvent(
      {
        handle: 9,
        title: 'Support Sync',
        startDate: new Date('2026-05-04T09:30:00.000Z'),
        endDate: new Date('2026-05-04T10:30:00.000Z'),
        isAllDay: false,
        isPrivate: false,
        createOnlineMeeting: false,
        recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;COUNT=5',
        type: { color: '#00897B' } as never,
        status: { color: '#43A047' } as never,
        creatorPerson: {} as never,
        creatorCompany: {} as never,
        transactionHandle: 'abc123',
      },
      new Date('2026-05-10T00:00:00.000Z'),
      new Date('2026-05-20T23:59:59.999Z'),
    )

    expect(occurrences).toHaveLength(3)
    expect(occurrences.map((item) => new Date(item.start).toISOString())).toEqual([
      '2026-05-11T09:30:00.000Z',
      '2026-05-13T09:30:00.000Z',
      '2026-05-18T09:30:00.000Z',
    ])
    expect(occurrences.every((item) => item.isRecurringOccurrence === true)).toBe(true)
  })

  it('keeps the local event time across the daylight-saving transition', () => {
    vi.stubEnv('TZ', 'Europe/Berlin')

    try {
      const occurrences = expandRecurringEvent(
        {
          handle: 260,
          title: 'Morning round',
          startDate: new Date('2026-09-21T06:00:00.000Z'),
          endDate: new Date('2026-09-21T15:00:00.000Z'),
          isAllDay: false,
          isPrivate: false,
          createOnlineMeeting: false,
          recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=6',
          creatorPerson: {} as never,
          creatorCompany: {} as never,
          transactionHandle: 'dst260',
        },
        new Date('2026-09-21T00:00:00.000Z'),
        new Date('2026-10-27T00:00:00.000Z'),
      )

      expect(occurrences.map((item) => new Date(item.start).toISOString())).toEqual([
        '2026-09-21T06:00:00.000Z',
        '2026-09-28T06:00:00.000Z',
        '2026-10-05T06:00:00.000Z',
        '2026-10-12T06:00:00.000Z',
        '2026-10-19T06:00:00.000Z',
        '2026-10-26T07:00:00.000Z',
      ])
      expect(occurrences.at(-1)?.end).toBe(new Date('2026-10-26T16:00:00.000Z').getTime())
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('suppresses occurrences that were detached from the series', () => {
    const occurrences = expandRecurringEvent(
      {
        handle: 9,
        title: 'Support Sync',
        startDate: new Date('2026-05-04T09:30:00.000Z'),
        endDate: new Date('2026-05-04T10:30:00.000Z'),
        isAllDay: false,
        isPrivate: false,
        createOnlineMeeting: false,
        recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=3',
        recurrenceExceptionDates: ['2026-05-05T09:30:00.000Z'],
        creatorPerson: {} as never,
        creatorCompany: {} as never,
        transactionHandle: 'abc123',
      },
      new Date('2026-05-04T00:00:00.000Z'),
      new Date('2026-05-07T00:00:00.000Z'),
    )

    expect(occurrences.map((item) => new Date(item.start).toISOString())).toEqual([
      '2026-05-04T09:30:00.000Z',
      '2026-05-06T09:30:00.000Z',
    ])
  })

  it('supports legacy JSON-serialized recurrence exception dates', () => {
    const occurrences = expandRecurringEvent(
      {
        handle: 9,
        title: 'Support Sync',
        startDate: new Date('2026-05-04T09:30:00.000Z'),
        endDate: new Date('2026-05-04T10:30:00.000Z'),
        isAllDay: false,
        isPrivate: false,
        createOnlineMeeting: false,
        recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=3',
        recurrenceExceptionDates: '["2026-05-05T09:30:00.000Z"]' as never,
        creatorPerson: {} as never,
        creatorCompany: {} as never,
        transactionHandle: 'abc123',
      },
      new Date('2026-05-04T00:00:00.000Z'),
      new Date('2026-05-07T00:00:00.000Z'),
    )

    expect(occurrences.map((item) => new Date(item.start).toISOString())).toEqual([
      '2026-05-04T09:30:00.000Z',
      '2026-05-06T09:30:00.000Z',
    ])
  })

  it('ignores malformed recurrence exception values without aborting expansion', () => {
    const occurrences = expandRecurringEvent(
      {
        handle: 9,
        title: 'Support Sync',
        startDate: new Date('2026-05-04T09:30:00.000Z'),
        endDate: new Date('2026-05-04T10:30:00.000Z'),
        isAllDay: false,
        isPrivate: false,
        createOnlineMeeting: false,
        recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=3',
        recurrenceExceptionDates: { unexpected: true } as never,
        creatorPerson: {} as never,
        creatorCompany: {} as never,
        transactionHandle: 'abc123',
      },
      new Date('2026-05-04T00:00:00.000Z'),
      new Date('2026-05-07T00:00:00.000Z'),
    )

    expect(occurrences).toHaveLength(3)
  })

  it('estimates the last recurrence date for count based series', () => {
    const endDate = getRecurrenceEndDate({
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;COUNT=5',
      startDate: '2026-05-04',
      startTime: '09:30',
      isAllDay: false,
    })

    expect(
      endDate && [
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        endDate.getDate(),
        endDate.getHours(),
        endDate.getMinutes(),
      ],
    ).toEqual([2026, 5, 18, 9, 30])
  })
})
