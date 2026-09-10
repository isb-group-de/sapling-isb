import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventItem, HolidayItem, PersonItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import type { CalendarDatePair } from '../eventDate.utils'
import type { SaplingCalendarEvent } from '../eventCalendar.utils'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findAll: vi.fn(),
  findByHandles: vi.fn(),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: mocks.find,
    findAll: mocks.findAll,
    findByHandles: mocks.findByHandles,
  },
}))

import { useSaplingEventData } from '../useSaplingEventData'

const visibleRange: CalendarDatePair = {
  start: { date: '2026-07-13', year: 2026, month: 7, day: 13, hour: 0, minute: 0 },
  end: { date: '2026-07-19', year: 2026, month: 7, day: 19, hour: 0, minute: 0 },
}

const nextVisibleRange: CalendarDatePair = {
  start: { date: '2026-07-20', year: 2026, month: 7, day: 20, hour: 0, minute: 0 },
  end: { date: '2026-07-26', year: 2026, month: 7, day: 26, hour: 0, minute: 0 },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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
    mocks.findAll.mockReset()
    mocks.findByHandles.mockReset()
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
    mocks.findAll.mockResolvedValueOnce([event]).mockResolvedValueOnce([holiday])

    await harness.data.getEvents(visibleRange)

    expect(harness.calendarDateRange.value).toEqual(visibleRange)
    expect(mocks.findAll).toHaveBeenNthCalledWith(
      1,
      'event',
      expect.objectContaining({
        fields: expect.arrayContaining([
          'onlineMeetingURL',
          'type.icon',
          'type.color',
          'type.showInDefaultCalendar',
          'category.icon',
          'category.color',
          'status.color',
        ]),
        relations: expect.arrayContaining(['type', 'category']),
        filter: expect.objectContaining({
          $and: expect.arrayContaining([
            { participants: [7] },
            { status: { handle: { $in: [1] } } },
          ]),
        }),
      }),
    )
    expect(mocks.findAll).toHaveBeenNthCalledWith(
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
    mocks.findByHandles.mockResolvedValueOnce([person])

    await harness.data.loadSelectedPeopleDetails()

    expect(harness.peopleMap.value[7]).toEqual(person)
    expect(mocks.findByHandles).toHaveBeenCalledWith(
      'person',
      [7],
      expect.objectContaining({
        relations: expect.arrayContaining([
          'workWeek.monday',
          'workWeek.friday',
          'company.workWeek.monday',
          'company.workWeek.friday',
        ]),
      }),
    )
  })

  it('keeps the newest range and coalesces identical calendar loads', async () => {
    const harness = createHarness()
    const firstEvents = deferred<EventItem[]>()
    const firstHolidays = deferred<HolidayItem[]>()
    const latestEvents = deferred<EventItem[]>()
    const latestHolidays = deferred<HolidayItem[]>()
    mocks.findAll
      .mockReturnValueOnce(firstEvents.promise)
      .mockReturnValueOnce(firstHolidays.promise)
      .mockReturnValueOnce(latestEvents.promise)
      .mockReturnValueOnce(latestHolidays.promise)

    const firstLoad = harness.data.getEvents(visibleRange)
    const firstSignal = mocks.findAll.mock.calls[0]?.[1]?.signal as AbortSignal
    const latestLoad = harness.data.getEvents(nextVisibleRange)
    const duplicateLatestLoad = harness.data.getEvents(nextVisibleRange)

    expect(firstSignal.aborted).toBe(true)
    expect(mocks.findAll).toHaveBeenCalledTimes(4)

    latestEvents.resolve([
      {
        handle: 52,
        title: 'Latest week',
        startDate: '2026-07-21T09:00:00.000Z',
        endDate: '2026-07-21T10:00:00.000Z',
        isAllDay: false,
        participants: [{ handle: 7 }],
      } as unknown as EventItem,
    ])
    latestHolidays.resolve([])
    await Promise.all([latestLoad, duplicateLatestLoad])

    expect(harness.events.value.map((item) => item.event?.title)).toEqual(['Latest week'])

    firstEvents.resolve([
      {
        handle: 42,
        title: 'Stale week',
        startDate: '2026-07-15T09:00:00.000Z',
        endDate: '2026-07-15T10:00:00.000Z',
        isAllDay: false,
        participants: [{ handle: 7 }],
      } as unknown as EventItem,
    ])
    firstHolidays.resolve([])
    await firstLoad

    expect(harness.calendarDateRange.value).toEqual(nextVisibleRange)
    expect(harness.events.value.map((item) => item.event?.title)).toEqual(['Latest week'])
  })

  it('loads a persisted event by handle and ignores empty handles', async () => {
    const harness = createHarness()
    const event = { handle: 42, title: 'Planning' } as EventItem
    mocks.find.mockResolvedValueOnce({ data: [event] })

    await expect(harness.data.loadPersistedEvent(42)).resolves.toEqual(event)
    await expect(harness.data.loadPersistedEvent(undefined)).resolves.toBeNull()
    expect(mocks.find).toHaveBeenCalledTimes(1)
    expect(mocks.find).toHaveBeenCalledWith('event', {
      filter: { handle: 42 },
      limit: 1,
      relations: ['m:1', 'participants'],
    })
  })
})
