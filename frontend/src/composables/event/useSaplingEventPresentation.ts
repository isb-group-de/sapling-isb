import { computed, type CSSProperties, type Ref } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { HolidayItem, PersonItem } from '@/entity/entity'
import { i18n } from '@/i18n'
import { formatDateFromTo, formatDateValue, formatTimeValue } from '@/utils/saplingFormatUtil'
import { isRecurringCalendarEvent } from '@/utils/eventRecurrence'
import {
  formatLocalDate,
  getWeekNumber,
  isValidDate,
  parseLocalCalendarDate,
  type CalendarDatePair,
  type CalendarType,
} from '@/composables/event/eventDate.utils'
import {
  getCalendarEventAccentColor,
  getCalendarEventHandle,
  getCalendarEventIcon,
  getCalendarEventOnlineMeetingUrl,
  getCalendarEventTitle,
  hasParticipant,
  isReadonlyCalendarEvent,
  normalizeParticipantNames,
  resolveHolidayGroupHandle,
  resolveParticipantHandle,
  resolvePersonHolidayGroupHandle,
  type CalendarParticipant,
  type CalendarViewMode,
  type SaplingCalendarEvent,
} from '@/composables/event/eventCalendar.utils'

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

export interface EventAgendaItem {
  key: string
  title: string
  dateLabel: string
  timeLabel: string
  onlineMeetingUrl: string | null
  participantNames: string[]
  icon: string
  accentColor: string
  isOngoing: boolean
  isRecurring: boolean
  calendarEvent: CalendarEvent
}

export interface SelectedPersonPreviewItem {
  handle: number
  name: string
  isOwn: boolean
}

export interface EventHeroStat {
  key: string
  label: string
  value: string
  icon: string
}

interface UseSaplingEventPresentationOptions {
  events: Ref<SaplingCalendarEvent[]>
  selectedPeople: Ref<number[]>
  ownPerson: Ref<PersonItem | null>
  peopleMap: Ref<Record<number, PersonItem>>
  calendarType: Ref<CalendarType>
  calendarViewMode: Ref<CalendarViewMode>
  calendarDateRange: Ref<CalendarDatePair | null>
  calendarValue: Ref<string>
  createEvent: Ref<CalendarEvent | null>
  getEventColor: (event: CalendarEvent) => string
}

/** Projects loaded calendar state into labels, cards, stats, and person columns. */
export function useSaplingEventPresentation(options: UseSaplingEventPresentationOptions) {
  const currentMonthLabel = computed(() => {
    if (!options.calendarValue.value) {
      return ''
    }

    const date = parseLocalCalendarDate(options.calendarValue.value)
    if (!isValidDate(date)) {
      return ''
    }

    const month = i18n.global.t(`event.${MONTH_NAMES[date.getMonth()]}`)
    const calendarWeek = i18n.global.t('event.kalendarWeek')

    if (options.calendarType.value === 'month') {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      return `${month} ${date.getFullYear()} · ${calendarWeek} ${getWeekNumber(firstDay)}–${getWeekNumber(lastDay)}`
    }

    return `${month} ${date.getFullYear()} · ${calendarWeek} ${getWeekNumber(date)}`
  })

  const currentDateRangeLabel = computed(() => {
    const range = options.calendarDateRange.value
    if (range?.start?.date && range?.end?.date) {
      return formatDateFromTo(range.start.date, range.end.date)
    }

    return formatDateValue(parseLocalCalendarDate(options.calendarValue.value))
  })

  const sortedVisibleEvents = computed(() =>
    [...options.events.value].sort((left, right) => Number(left.start) - Number(right.start)),
  )

  const todayEventsCount = computed(() => {
    const { startOfDay, endOfDay } = getTodayRange()
    return options.events.value.filter(
      (event) => event.start <= endOfDay && event.end >= startOfDay,
    ).length
  })

  const selectedPeoplePreview = computed<SelectedPersonPreviewItem[]>(() =>
    options.selectedPeople.value.slice(0, 6).map((personId) => ({
      handle: personId,
      name: getPersonName(personId),
      isOwn: options.ownPerson.value?.handle === personId,
    })),
  )

  const selectedPeopleOverflowCount = computed(() =>
    Math.max(options.selectedPeople.value.length - selectedPeoplePreview.value.length, 0),
  )

  const upcomingEvents = computed<EventAgendaItem[]>(() => {
    const now = Date.now()
    const { startOfDay, endOfDay } = getTodayRange()

    return sortedVisibleEvents.value
      .filter((event) => event.start <= endOfDay && event.end >= startOfDay)
      .map((event, index) => {
        const startDate = new Date(event.start)
        const endDate = new Date(event.end)
        const sameDay = formatLocalDate(startDate) === formatLocalDate(endDate)
        const occurrenceKey =
          (event as CalendarEvent & { recurrenceOccurrenceStart?: string })
            .recurrenceOccurrenceStart ?? `${event.start}-${event.end}-${index}`

        return {
          key: String(getCalendarEventHandle(event) ?? 'event') + `-${occurrenceKey}`,
          title: getCalendarEventTitle(event, i18n.global.t('navigation.event')),
          dateLabel: sameDay
            ? formatDateValue(startDate)
            : `${formatDateValue(startDate)} - ${formatDateValue(endDate)}`,
          timeLabel: event.timed
            ? `${formatTimeValue(startDate)} - ${formatTimeValue(endDate)}`
            : '',
          onlineMeetingUrl: getCalendarEventOnlineMeetingUrl(event),
          participantNames: getCalendarEventParticipants(event),
          icon: getCalendarEventIcon(event),
          accentColor: getCalendarEventAccentColor(event, options.getEventColor(event)),
          isOngoing: event.start <= now && event.end >= now,
          isRecurring: isRecurringCalendarEvent(event),
          calendarEvent: event,
        }
      })
  })

  const heroStats = computed<EventHeroStat[]>(() => [
    {
      key: 'visible-events',
      label: i18n.global.t('navigation.event'),
      value: String(options.events.value.length),
      icon: 'mdi-calendar-clock-outline',
    },
    {
      key: 'today-events',
      label: i18n.global.t('event.today'),
      value: String(todayEventsCount.value),
      icon: 'mdi-calendar-today',
    },
    {
      key: 'selected-people',
      label: i18n.global.t('navigation.person'),
      value: String(options.selectedPeople.value.length),
      icon: 'mdi-account-group-outline',
    },
  ])

  const sideBySideGridStyle = computed<CSSProperties>(() => {
    const selectedCount = options.selectedPeople.value.length
    return selectedCount <= 2
      ? { gridTemplateColumns: `repeat(${Math.max(selectedCount, 1)}, minmax(0, 1fr))` }
      : { gridTemplateColumns: `repeat(${selectedCount}, minmax(420px, 1fr))` }
  })

  function getEventsForPerson(personId: number) {
    return options.events.value.filter((event) =>
      isReadonlyCalendarEvent(event)
        ? isHolidayVisibleForPerson(event, personId)
        : hasParticipant(event, personId),
    )
  }

  function getSideBySideEvents(personId: number) {
    const personEvents = getEventsForPerson(personId)
    const draftEvent = getDraftEventForPerson(personId)
    return draftEvent ? [...personEvents, draftEvent] : personEvents
  }

  function getPersonName(personId: number) {
    const person = getCalendarPerson(personId)
    if (person) {
      const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
      return (
        person.displayName ||
        fullName ||
        person.name ||
        person.email ||
        `${i18n.global.t('global.person')} ${personId}`
      )
    }

    return `${i18n.global.t('global.person')} ${personId}`
  }

  function getCalendarEventParticipants(event: CalendarEvent) {
    return isReadonlyCalendarEvent(event)
      ? []
      : normalizeParticipantNames(event.event?.participants, resolveParticipantName)
  }

  function getDraftEventForPerson(personId: number) {
    const draft = options.createEvent.value
    if (options.calendarViewMode.value !== 'sidebyside' || !draft) {
      return null
    }

    const participants = draft.event?.participants
    if (
      Array.isArray(participants) &&
      participants.length > 0 &&
      !participants.some((participant) => resolveParticipantHandle(participant) === personId)
    ) {
      return null
    }

    return {
      ...draft,
      event: { ...(draft.event || {}), participants: [personId] },
    }
  }

  function resolveParticipantName(participant: CalendarParticipant) {
    if (typeof participant === 'number') {
      return getPersonName(participant)
    }
    if (typeof participant === 'string') {
      const parsed = Number.parseInt(participant, 10)
      return Number.isNaN(parsed) ? participant.trim() || null : getPersonName(parsed)
    }

    const fullName = [participant.firstName, participant.lastName].filter(Boolean).join(' ').trim()
    return (
      participant.displayName ||
      fullName ||
      participant.name ||
      participant.email ||
      (participant.handle != null ? getPersonName(participant.handle) : null)
    )
  }

  function getCalendarPerson(personId: number) {
    return options.ownPerson.value?.handle === personId
      ? options.ownPerson.value
      : (options.peopleMap.value[personId] ?? null)
  }

  function getSelectedHolidayGroupHandles() {
    return Array.from(
      new Set(
        options.selectedPeople.value
          .map((personId) => resolvePersonHolidayGroupHandle(getCalendarPerson(personId)))
          .filter((handle): handle is number => handle != null),
      ),
    )
  }

  function isHolidayVisibleForPerson(event: CalendarEvent, personId: number) {
    const personHolidayGroupHandle = resolvePersonHolidayGroupHandle(getCalendarPerson(personId))
    return (
      personHolidayGroupHandle != null &&
      resolveHolidayGroupHandle((event.event as HolidayItem | undefined)?.group) ===
        personHolidayGroupHandle
    )
  }

  return {
    currentDateRangeLabel,
    currentMonthLabel,
    getCalendarEventParticipants,
    getEventsForPerson,
    getPersonName,
    getSelectedHolidayGroupHandles,
    getSideBySideEvents,
    heroStats,
    selectedPeopleOverflowCount,
    selectedPeoplePreview,
    sideBySideGridStyle,
    todayEventsCount,
    upcomingEvents,
  }
}

function getTodayRange() {
  const today = new Date()
  return {
    startOfDay: new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
    endOfDay: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999,
    ).getTime(),
  }
}
