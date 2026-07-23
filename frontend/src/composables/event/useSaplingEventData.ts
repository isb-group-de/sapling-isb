import type { Ref } from 'vue'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import type { EventItem, HolidayItem, PersonItem } from '@/entity/entity'
import { expandRecurringEvent } from '@/utils/eventRecurrence'
import { parseLocalCalendarDate, type CalendarDatePair, type CalendarType } from './eventDate.utils'
import {
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
  'onlineMeetingURL',
  'type',
  'participants',
  'status',
  'assigneeCompany',
  'assigneePerson',
  'creatorCompany',
  'creatorPerson',
  'updatedAt',
]
const EVENT_CALENDAR_RELATIONS = [
  'participants',
  'type',
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
  async function loadSelectedPeopleDetails() {
    const selectedHandles = Array.from(
      new Set(options.selectedPeople.value.filter((handle) => Number.isInteger(handle))),
    )
    if (selectedHandles.length === 0) {
      return
    }

    const response = await ApiGenericService.find<PersonItem>('person', {
      filter: { handle: { $in: selectedHandles } },
      relations: ['company', 'holidayGroup', 'company.holidayGroup'],
      limit: selectedHandles.length,
    })

    response.data.forEach((person) => {
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

  async function getEvents(nextRange: CalendarDatePair) {
    options.calendarDateRange.value = nextRange

    const startDate = parseLocalCalendarDate(nextRange.start.date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = parseLocalCalendarDate(nextRange.end.date)
    endDate.setHours(23, 59, 59, 999)

    const holidayGroupHandles = options.getSelectedHolidayGroupHandles()
    const [response, holidayResponse] = await Promise.all([
      ApiGenericService.find<EventItem>('event', {
        relations: EVENT_CALENDAR_RELATIONS,
        fields: EVENT_CALENDAR_FIELDS,
        filter: {
          $and: [
            { participants: options.selectedPeople.value },
            ...options.buildChipFilterClauses(),
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
        ? ApiGenericService.find<HolidayItem>('holiday', {
            relations: ['group'],
            fields: HOLIDAY_CALENDAR_FIELDS,
            filter: {
              $and: [
                { group: { $in: holidayGroupHandles } },
                { startDate: { $lte: endDate.toISOString() } },
                { endDate: { $gte: startDate.toISOString() } },
              ],
            },
          })
        : Promise.resolve({ data: [] as HolidayItem[] }),
    ])

    options.events.value = filterWorkweekEvents(
      filterByCalendarMode(
        [
          ...response.data.flatMap((event) =>
            expandRecurringEvent(event, startDate, endDate).map((calendarEvent) => ({
              ...calendarEvent,
              saplingSource: 'event' as const,
            })),
          ),
          ...holidayResponse.data.map(toHolidayCalendarEvent),
        ],
        options.calendarMode.value,
      ),
      options.calendarType.value,
    )
  }

  async function loadPersistedEvent(handle: EventItem['handle']) {
    if (handle == null) {
      return null
    }

    const result = await ApiGenericService.find<EventItem>('event', {
      filter: { handle },
      limit: 1,
      relations: ['m:1'],
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
