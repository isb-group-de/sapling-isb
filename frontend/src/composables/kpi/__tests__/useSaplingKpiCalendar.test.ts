import { describe, expect, it } from 'vitest'
import type { EventItem, KPIItem } from '@/entity/entity'
import { buildCalendarAgendaEntries, buildCalendarAgendaFilter } from '../useSaplingKpiCalendar'

function event(overrides: Partial<EventItem>): EventItem {
  return {
    handle: 1,
    title: 'Termin',
    startDate: new Date('2026-08-18T10:00:00.000Z'),
    endDate: new Date('2026-08-18T11:00:00.000Z'),
    isAllDay: false,
    isPrivate: false,
    createOnlineMeeting: false,
    creatorPerson: {} as never,
    creatorCompany: {} as never,
    transactionHandle: 'test',
    ...overrides,
  }
}

function kpi(filter?: Record<string, unknown>): KPIItem {
  return {
    handle: 1,
    name: 'Agenda',
    aggregation: { handle: 'COUNT' },
    field: 'handle',
    type: 'CALENDAR',
    targetEntity: 'event',
    filter,
    createdAt: null,
  }
}

describe('useSaplingKpiCalendar helpers', () => {
  it('combines the current participant, configured KPI filter and 90-day overlap query', () => {
    const start = new Date('2026-08-18T08:00:00.000Z')
    const end = new Date('2026-11-16T08:00:00.000Z')
    const filter = buildCalendarAgendaFilter(kpi({ status: 'scheduled' }), 42, start, end)

    expect(filter).toEqual({
      $and: [
        { participants: [42] },
        { status: 'scheduled' },
        {
          $or: [
            {
              $and: [
                { startDate: { $lte: end.toISOString() } },
                { endDate: { $gte: start.toISOString() } },
              ],
            },
            {
              $and: [{ recurrenceRule: { $ne: null } }, { recurrenceRule: { $ne: '' } }],
            },
          ],
        },
      ],
    })
  })

  it('includes ongoing and all-day events, expands recurrences, sorts and limits the agenda', () => {
    const rangeStart = new Date('2026-08-18T08:00:00.000Z')
    const rangeEnd = new Date('2026-08-25T08:00:00.000Z')
    const events = [
      event({
        handle: 10,
        title: 'Laufend',
        startDate: new Date('2026-08-18T07:30:00.000Z'),
        endDate: new Date('2026-08-18T08:30:00.000Z'),
        type: {
          handle: 'meeting',
          title: 'Besprechung',
          icon: 'mdi-account-group',
          color: '#123456',
          createdAt: null,
        },
      }),
      event({
        handle: 11,
        title: 'Ganztägig',
        startDate: new Date('2026-08-19T00:00:00.000Z'),
        endDate: new Date('2026-08-19T23:59:59.000Z'),
        isAllDay: true,
        category: {
          handle: 'internal',
          title: 'Intern',
          icon: 'mdi-office-building',
          color: '#654321',
        },
      }),
      event({
        handle: 12,
        title: 'Serie',
        startDate: new Date('2026-08-18T12:00:00.000Z'),
        endDate: new Date('2026-08-18T12:30:00.000Z'),
        recurrenceRule: 'FREQ=DAILY;COUNT=4',
      }),
      event({
        handle: 13,
        title: 'Abgelaufen',
        startDate: new Date('2026-08-17T07:00:00.000Z'),
        endDate: new Date('2026-08-17T08:00:00.000Z'),
      }),
    ]

    const entries = buildCalendarAgendaEntries(events, rangeStart, rangeEnd, 5)

    expect(entries).toHaveLength(5)
    expect(entries.map((entry) => entry.title)).toEqual([
      'Laufend',
      'Serie',
      'Ganztägig',
      'Serie',
      'Serie',
    ])
    expect(entries[0]).toMatchObject({
      handle: 10,
      icon: 'mdi-account-group',
      color: '#123456',
      metaLabel: 'Besprechung',
    })
    expect(entries[2]).toMatchObject({
      isAllDay: true,
      icon: 'mdi-office-building',
      color: '#654321',
      metaLabel: 'Intern',
    })
  })
})
