import { describe, expect, it } from 'vitest'
import type { EventItem } from '@/entity/entity'
import { getOpenTaskEventOccurrence } from '@/utils/openTaskEvent'

function createEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    handle: 42,
    title: 'Daily review',
    startDate: new Date('2026-08-27T09:00:00.000Z'),
    endDate: new Date('2026-08-27T10:00:00.000Z'),
    isAllDay: false,
    ...overrides,
  } as EventItem
}

describe('getOpenTaskEventOccurrence', () => {
  it('keeps the persisted dates for a standalone event', () => {
    expect(getOpenTaskEventOccurrence(createEvent())).toEqual({
      startDate: new Date('2026-08-27T09:00:00.000Z'),
      endDate: new Date('2026-08-27T10:00:00.000Z'),
      recurrenceOccurrenceStart: null,
    })
  })

  it('advances a recurring open task past detached occurrences', () => {
    expect(
      getOpenTaskEventOccurrence(
        createEvent({
          recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=4',
          recurrenceExceptionDates: ['2026-08-27T09:00:00.000Z', '2026-08-28T09:00:00.000Z'],
        }),
      ),
    ).toEqual({
      startDate: new Date('2026-08-29T09:00:00.000Z'),
      endDate: new Date('2026-08-29T10:00:00.000Z'),
      recurrenceOccurrenceStart: '2026-08-29T09:00:00.000Z',
    })
  })

  it('returns no occurrence when every generated occurrence was detached', () => {
    expect(
      getOpenTaskEventOccurrence(
        createEvent({
          recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=2',
          recurrenceExceptionDates: ['2026-08-27T09:00:00.000Z', '2026-08-28T09:00:00.000Z'],
        }),
      ),
    ).toBeNull()
  })

  it('advances open-ended series beyond the normal 100-occurrence calendar window', () => {
    const recurrenceExceptionDates = Array.from({ length: 150 }, (_, index) => {
      const date = new Date('2026-01-01T09:00:00.000Z')
      date.setUTCDate(date.getUTCDate() + index)
      return date.toISOString()
    })

    expect(
      getOpenTaskEventOccurrence(
        createEvent({
          startDate: new Date('2026-01-01T09:00:00.000Z'),
          endDate: new Date('2026-01-01T10:00:00.000Z'),
          recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
          recurrenceExceptionDates,
        }),
      ),
    ).toEqual({
      startDate: new Date('2026-05-31T09:00:00.000Z'),
      endDate: new Date('2026-05-31T10:00:00.000Z'),
      recurrenceOccurrenceStart: '2026-05-31T09:00:00.000Z',
    })
  })
})
