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

  async function getEvents(nextRange: CalendarDatePair) {
    options.calendarDateRange.value = nextRange

    const startDate = parseLocalCalendarDate(nextRange.start.date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = parseLocalCalendarDate(nextRange.end.date)
    endDate.setHours(23, 59, 59, 999)

    const holidayGroupHandles = options.getSelectedHolidayGroupHandles()
    const [eventItems, holidayItems] = await Promise.all([
      ApiGenericService.findAll<EventItem>('event', {
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
        ? ApiGenericService.findAll<HolidayItem>('holiday', {
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
        : Promise.resolve([] as HolidayItem[]),
    ])

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
