import type { Ref } from 'vue'
import { i18n } from '@/i18n'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import type { EventItem, HolidayItem, PersonItem } from '@/entity/entity'
import { expandRecurringEvent } from '@/utils/eventRecurrence'
import { parseLocalCalendarDate, type CalendarDatePair, type CalendarType } from './eventDate.utils'
import {
  addEventBufferPlaceholders,
  filterByCalendarMode,
  filterWorkweekEvents,
  toHolidayCalendarEvent,
  type CalendarMode,
  type SaplingCalendarEvent,
} from './eventCalendar.utils'

const EVENT_CALENDAR_FIELDS = [
  'handle',
  'title',
  'description',
  'startDate',
  'endDate',
  'isAllDay',
  'isPrivate',
  'recurrenceRule',
  'recurrenceExceptionDates',
  'preparationDuration',
  'followUpDuration',
  'onlineMeetingURL',
  'type',
  'type.icon',
  'type.color',
  'type.showInDefaultCalendar',
  'category',
  'category.icon',
  'category.color',
  'participants',
  'status',
  'status.color',
  'assigneeCompany',
  'assigneePerson',
  'creatorCompany',
  'creatorPerson',
  'updatedAt',
]
const EVENT_CALENDAR_RELATIONS = [
  'participants',
  'type',
  'category',
  'status',
  'assigneeCompany',
  'assigneePerson',
  'creatorCompany',
  'creatorPerson',
]
const HOLIDAY_CALENDAR_FIELDS = [
  'handle',
  'title',
  'description',
  'group',
  'startDate',
  'endDate',
  'isAllDay',
  'icon',
  'color',
]
const PERSON_CALENDAR_RELATIONS = [
  'company',
  'holidayGroup',
  'company.holidayGroup',
  'workWeek',
  'workWeek.monday',
  'workWeek.tuesday',
  'workWeek.wednesday',
  'workWeek.thursday',
  'workWeek.friday',
  'workWeek.saturday',
  'workWeek.sunday',
  'company.workWeek',
  'company.workWeek.monday',
  'company.workWeek.tuesday',
  'company.workWeek.wednesday',
  'company.workWeek.thursday',
  'company.workWeek.friday',
  'company.workWeek.saturday',
  'company.workWeek.sunday',
]

interface UseSaplingEventDataOptions {
  events: Ref<SaplingCalendarEvent[]>
  selectedPeople: Ref<number[]>
  peopleMap: Ref<Record<number, PersonItem>>
  calendarMode: Ref<CalendarMode>
  calendarType: Ref<CalendarType>
  calendarDateRange: Ref<CalendarDatePair | null>
  buildChipFilterClauses: () => FilterQuery[]
  getSelectedHolidayGroupHandles: () => number[]
}

/** Owns calendar read queries and normalization into visible event records. */
export function useSaplingEventData(options: UseSaplingEventDataOptions) {
  let activeCalendarLoad:
    | {
        controller: AbortController
        promise: Promise<void>
        requestId: number
        signature: string
      }
    | undefined
  let latestCalendarLoadRequestId = 0

  async function loadSelectedPeopleDetails() {
    const selectedHandles = Array.from(
      new Set(options.selectedPeople.value.filter((handle) => Number.isInteger(handle))),
    )
    if (selectedHandles.length === 0) {
      return
    }

    const people = await ApiGenericService.findByHandles<PersonItem>('person', selectedHandles, {
      relations: PERSON_CALENDAR_RELATIONS,
    })

    people.forEach((person) => {
      if (typeof person.handle === 'number') {
        options.peopleMap.value[person.handle] = person
      }
    })
  }

  async function refreshVisibleEvents() {
    if (options.calendarDateRange.value) {
      await getEvents(options.calendarDateRange.value)
    }
  }

  function getEvents(nextRange: CalendarDatePair): Promise<void> {
    options.calendarDateRange.value = nextRange

    const startDate = parseLocalCalendarDate(nextRange.start.date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = parseLocalCalendarDate(nextRange.end.date)
    endDate.setHours(23, 59, 59, 999)

    const selectedPeople = [...options.selectedPeople.value]
    const chipFilterClauses = options.buildChipFilterClauses()
    const holidayGroupHandles = options.getSelectedHolidayGroupHandles()
    const calendarMode = options.calendarMode.value
    const calendarType = options.calendarType.value
    const signature = JSON.stringify({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      selectedPeople,
      chipFilterClauses,
      holidayGroupHandles,
      calendarMode,
      calendarType,
    })

    if (activeCalendarLoad?.signature === signature) {
      return activeCalendarLoad.promise
    }

    activeCalendarLoad?.controller.abort()
    const controller = new AbortController()
    const requestId = ++latestCalendarLoadRequestId
    const promise = loadEvents({
      startDate,
      endDate,
      selectedPeople,
      chipFilterClauses,
      holidayGroupHandles,
      calendarMode,
      calendarType,
      controller,
      requestId,
    }).finally(() => {
      if (activeCalendarLoad?.requestId === requestId) {
        activeCalendarLoad = undefined
      }
    })

    activeCalendarLoad = { controller, promise, requestId, signature }
    return promise
  }

  async function loadEvents({
    startDate,
    endDate,
    selectedPeople,
    chipFilterClauses,
    holidayGroupHandles,
    calendarMode,
    calendarType,
    controller,
    requestId,
  }: {
    startDate: Date
    endDate: Date
    selectedPeople: number[]
    chipFilterClauses: FilterQuery[]
    holidayGroupHandles: number[]
    calendarMode: CalendarMode
    calendarType: CalendarType
    controller: AbortController
    requestId: number
  }) {
    try {
      const [eventItems, holidayItems] = await Promise.all([
        ApiGenericService.findAll<EventItem>('event', {
          relations: EVENT_CALENDAR_RELATIONS,
          fields: EVENT_CALENDAR_FIELDS,
          signal: controller.signal,
          filter: {
            $and: [
              { participants: selectedPeople },
              ...chipFilterClauses,
              {
                $or: [
                  {
                    $and: [
                      { startDate: { $lte: endDate.toISOString() } },
                      { endDate: { $gte: startDate.toISOString() } },
                    ],
                  },
                  {
                    $and: [{ recurrenceRule: { $ne: null } }, { recurrenceRule: { $ne: '' } }],
                  },
                ],
              },
            ],
          },
        }),
        holidayGroupHandles.length > 0
          ? ApiGenericService.findAll<HolidayItem>('holiday', {
              relations: ['group'],
              fields: HOLIDAY_CALENDAR_FIELDS,
              signal: controller.signal,
              filter: {
                $and: [
                  { group: { $in: holidayGroupHandles } },
                  { startDate: { $lte: endDate.toISOString() } },
                  { endDate: { $gte: startDate.toISOString() } },
                ],
              },
            })
          : Promise.resolve([] as HolidayItem[]),
      ])

      if (requestId !== latestCalendarLoadRequestId) {
        return
      }

      options.events.value = filterWorkweekEvents(
        filterByCalendarMode(
          [
            ...eventItems.flatMap((event) =>
              expandRecurringEvent(event, startDate, endDate).flatMap((calendarEvent) =>
                addEventBufferPlaceholders(
                  {
                    ...calendarEvent,
                    saplingSource: 'event' as const,
                  },
                  {
                    preparation: i18n.global.t('event.preparationPlaceholder'),
                    followUp: i18n.global.t('event.followUpPlaceholder'),
                  },
                ),
              ),
            ),
            ...holidayItems.map(toHolidayCalendarEvent),
          ],
          calendarMode,
        ),
        calendarType,
      )
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      throw error
    }
  }

  async function loadPersistedEvent(handle: EventItem['handle']) {
    if (handle == null) {
      return null
    }

    const result = await ApiGenericService.find<EventItem>('event', {
      filter: { handle },
      limit: 1,
      relations: ['m:1', 'participants'],
    })
    return result.data[0] ?? null
  }

  return {
    getEvents,
    loadPersistedEvent,
    loadSelectedPeopleDetails,
    refreshVisibleEvents,
  }
}
