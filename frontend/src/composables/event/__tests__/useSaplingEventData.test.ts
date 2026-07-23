import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventItem, HolidayItem, PersonItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import type { CalendarDatePair } from '../eventDate.utils'
import type { SaplingCalendarEvent } from '../eventCalendar.utils'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: { find: mocks.find },
}))

import { useSaplingEventData } from '../useSaplingEventData'

const visibleRange: CalendarDatePair = {
  start: { date: '2026-07-13', year: 2026, month: 7, day: 13, hour: 0, minute: 0 },
  end: { date: '2026-07-19', year: 2026, month: 7, day: 19, hour: 0, minute: 0 },
}

function createHarness() {
  const events = ref<SaplingCalendarEvent[]>([])
  const selectedPeople = ref([7])
  const peopleMap = ref<Record<number, PersonItem>>({})
  const calendarMode = ref<'default' | 'extended'>('extended')
  const calendarType = ref<'day' | 'workweek' | 'week' | 'month'>('week')
  const calendarDateRange = ref<CalendarDatePair | null>(null)
  const chipClause: FilterQuery = { status: { handle: { $in: [1] } } }
  const data = useSaplingEventData({
    events,
    selectedPeople,
    peopleMap,
    calendarMode,
    calendarType,
    calendarDateRange,
    buildChipFilterClauses: () => [chipClause],
    getSelectedHolidayGroupHandles: () => [3],
  })

  return { calendarDateRange, data, events, peopleMap }
}

describe('useSaplingEventData', () => {
  beforeEach(() => {
    mocks.find.mockReset()
  })

  it('loads events and holidays for the visible range with active filters', async () => {
    const harness = createHarness()
    const event = {
      handle: 42,
      title: 'Planning',
      startDate: '2026-07-15T09:00:00.000Z',
      endDate: '2026-07-15T10:00:00.000Z',
      isAllDay: false,
      participants: [{ handle: 7 }],
    } as unknown as EventItem
    const holiday = {
      handle: 11,
      title: 'Holiday',
      startDate: '2026-07-16T00:00:00.000Z',
      endDate: '2026-07-16T23:59:59.000Z',
      isAllDay: true,
      group: { handle: 3 },
    } as unknown as HolidayItem
    mocks.find.mockResolvedValueOnce({ data: [event] }).mockResolvedValueOnce({ data: [holiday] })

    await harness.data.getEvents(visibleRange)

    expect(harness.calendarDateRange.value).toEqual(visibleRange)
    expect(mocks.find).toHaveBeenNthCalledWith(
      1,
      'event',
      expect.objectContaining({
        fields: expect.arrayContaining(['onlineMeetingURL']),
        filter: expect.objectContaining({
          $and: expect.arrayContaining([
            { participants: [7] },
            { status: { handle: { $in: [1] } } },
          ]),
        }),
      }),
    )
    expect(mocks.find).toHaveBeenNthCalledWith(
      2,
      'holiday',
      expect.objectContaining({
        filter: expect.objectContaining({
          $and: expect.arrayContaining([{ group: { $in: [3] } }]),
        }),
      }),
    )
    expect(harness.events.value.map((item) => item.saplingSource)).toEqual(['event', 'holiday'])
  })

  it('hydrates selected people into the shared lookup map', async () => {
    const harness = createHarness()
    const person = { handle: 7, displayName: 'Ada Owner' } as unknown as PersonItem
    mocks.find.mockResolvedValueOnce({ data: [person] })

    await harness.data.loadSelectedPeopleDetails()

    expect(harness.peopleMap.value[7]).toEqual(person)
    expect(mocks.find).toHaveBeenCalledWith(
      'person',
      expect.objectContaining({
        filter: { handle: { $in: [7] } },
        limit: 1,
        relations: expect.arrayContaining([
          'workWeek.monday',
          'workWeek.friday',
          'company.workWeek.monday',
          'company.workWeek.friday',
        ]),
      }),
    )
  })

  it('loads a persisted event by handle and ignores empty handles', async () => {
    const harness = createHarness()
    const event = { handle: 42, title: 'Planning' } as EventItem
    mocks.find.mockResolvedValueOnce({ data: [event] })

    await expect(harness.data.loadPersistedEvent(42)).resolves.toEqual(event)
    await expect(harness.data.loadPersistedEvent(undefined)).resolves.toBeNull()
    expect(mocks.find).toHaveBeenCalledTimes(1)
  })
})
