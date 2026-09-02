import { describe, expect, it } from 'vitest'
import type { EventItem } from '@/entity/entity'
import {
  appendEventRecurrenceExceptions,
  buildEventCompletionPlan,
  buildEventCompletionTargetChunks,
  getDefaultEventCompletionCutoff,
  isValidEventCompletionCutoff,
  selectOverdueEventsThroughDate,
} from '@/utils/inboxEventCompletion'

const NOW = new Date(2026, 8, 2, 12, 0, 0)

function createEvent(handle: number, startDate: string, overrides: Partial<EventItem> = {}) {
  return {
    handle,
    title: `Event ${handle}`,
    startDate: new Date(startDate),
    endDate: new Date(startDate),
    isAllDay: false,
    ...overrides,
  } as EventItem
}

describe('inboxEventCompletion', () => {
  it('defaults to yesterday in local time', () => {
    expect(getDefaultEventCompletionCutoff(NOW)).toBe('2026-09-01')
  })

  it('accepts only real dates before today', () => {
    expect(isValidEventCompletionCutoff('2026-09-01', NOW)).toBe(true)
    expect(isValidEventCompletionCutoff('2026-09-02', NOW)).toBe(false)
    expect(isValidEventCompletionCutoff('2026-02-30', NOW)).toBe(false)
  })

  it('selects handled events through the inclusive cutoff and excludes later events', () => {
    const events = [
      createEvent(1, '2026-08-31T08:00:00.000Z'),
      createEvent(2, '2026-09-01T20:00:00.000Z'),
      createEvent(3, '2026-09-02T08:00:00.000Z'),
      createEvent(4, '2026-08-30T08:00:00.000Z', { handle: undefined }),
    ]

    expect(
      selectOverdueEventsThroughDate(events, '2026-09-01', NOW).map(({ handle }) => handle),
    ).toEqual([1, 2])
  })

  it('uses the first still-generated occurrence for recurring series', () => {
    const event = createEvent(5, '2026-08-30T08:00:00.000Z', {
      endDate: new Date('2026-08-30T09:00:00.000Z'),
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=5',
      recurrenceExceptionDates: [
        '2026-08-30T08:00:00.000Z',
        '2026-08-31T08:00:00.000Z',
        '2026-09-01T08:00:00.000Z',
      ],
    })

    expect(selectOverdueEventsThroughDate([event], '2026-09-01', NOW)).toEqual([])
    expect(selectOverdueEventsThroughDate([event], '2026-09-02', new Date(2026, 8, 3))).toEqual([
      event,
    ])
  })

  it('chunks large updates at the generic bulk API limit and preserves concurrency tokens', () => {
    const events = Array.from({ length: 201 }, (_, index) =>
      createEvent(index + 1, '2026-08-01T08:00:00.000Z', {
        updatedAt: new Date('2026-08-15T10:00:00.000Z'),
      }),
    )

    const chunks = buildEventCompletionTargetChunks(events)

    expect(chunks.map((chunk) => chunk.length)).toEqual([200, 1])
    expect(chunks[0]?.[0]).toEqual({
      handle: 1,
      expectedUpdatedAt: '2026-08-15T10:00:00.000Z',
    })
  })

  it('plans each yearly birthday occurrence through the cutoff without touching the future series', () => {
    const birthday = createEvent(12, '2022-05-10T08:00:00.000Z', {
      endDate: new Date('2022-05-10T09:00:00.000Z'),
      recurrenceRule: 'FREQ=YEARLY;INTERVAL=1',
      recurrenceExceptionDates: ['2022-05-10T08:00:00.000Z'],
    })

    const plan = buildEventCompletionPlan([birthday], '2025-12-31', new Date(2026, 0, 2))

    expect(plan).toEqual({
      standaloneEvents: [],
      recurringEvents: [
        {
          event: birthday,
          occurrenceStarts: [
            '2023-05-10T08:00:00.000Z',
            '2024-05-10T08:00:00.000Z',
            '2025-05-10T08:00:00.000Z',
          ],
        },
      ],
      completionCount: 3,
      isComplete: true,
    })
  })

  it('plans weekly recurring occurrences generically through the inclusive cutoff', () => {
    const weekly = createEvent(13, '2026-08-03T08:00:00.000Z', {
      endDate: new Date('2026-08-03T09:00:00.000Z'),
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE',
    })

    const plan = buildEventCompletionPlan([weekly], '2026-08-12', new Date(2026, 7, 13))

    expect(plan.recurringEvents[0]?.occurrenceStarts).toEqual([
      '2026-08-03T08:00:00.000Z',
      '2026-08-05T08:00:00.000Z',
      '2026-08-10T08:00:00.000Z',
      '2026-08-12T08:00:00.000Z',
    ])
    expect(plan.completionCount).toBe(4)
    expect(plan.isComplete).toBe(true)
  })

  it('merges processed starts into legacy recurrence exceptions for the next inbox snapshot', () => {
    const event = createEvent(14, '2026-08-03T08:00:00.000Z', {
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
      recurrenceExceptionDates: '["2026-08-03T08:00:00.000Z"]' as never,
      updatedAt: new Date('2026-08-10T12:00:00.000Z'),
    })

    expect(
      appendEventRecurrenceExceptions(event, [
        '2026-08-04T08:00:00.000Z',
        '2026-08-04T08:00:00.000Z',
      ]),
    ).toEqual(
      expect.objectContaining({
        recurrenceExceptionDates: ['2026-08-03T08:00:00.000Z', '2026-08-04T08:00:00.000Z'],
        updatedAt: undefined,
      }),
    )
  })
})
