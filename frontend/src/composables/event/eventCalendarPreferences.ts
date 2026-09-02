import type { CalendarType } from './eventDate.utils'
import type {
  CalendarEventOverlapMode,
  CalendarMode,
  CalendarViewMode,
} from './eventCalendar.utils'

export interface EventCalendarPreferences {
  calendarType: CalendarType
  calendarViewMode: CalendarViewMode
  calendarMode: CalendarMode
  eventOverlapMode: CalendarEventOverlapMode
  linkedScrolling: boolean
}

export const DEFAULT_EVENT_CALENDAR_PREFERENCES: EventCalendarPreferences = {
  calendarType: 'workweek',
  calendarViewMode: 'single',
  calendarMode: 'default',
  eventOverlapMode: 'stack',
  linkedScrolling: true,
}

const STORAGE_KEY = 'sapling.calendar.preferences'
const CALENDAR_TYPES = new Set<CalendarType>(['day', 'workweek', 'week', 'month'])
const CALENDAR_VIEW_MODES = new Set<CalendarViewMode>(['single', 'sidebyside'])
const CALENDAR_MODES = new Set<CalendarMode>(['default', 'extended'])
const EVENT_OVERLAP_MODES = new Set<CalendarEventOverlapMode>(['stack', 'column'])

export function loadEventCalendarPreferences(): EventCalendarPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_EVENT_CALENDAR_PREFERENCES }
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)
    if (!storedValue) {
      return { ...DEFAULT_EVENT_CALENDAR_PREFERENCES }
    }

    const parsed = JSON.parse(storedValue) as Partial<EventCalendarPreferences>
    return {
      calendarType: CALENDAR_TYPES.has(parsed.calendarType as CalendarType)
        ? (parsed.calendarType as CalendarType)
        : DEFAULT_EVENT_CALENDAR_PREFERENCES.calendarType,
      calendarViewMode: CALENDAR_VIEW_MODES.has(parsed.calendarViewMode as CalendarViewMode)
        ? (parsed.calendarViewMode as CalendarViewMode)
        : DEFAULT_EVENT_CALENDAR_PREFERENCES.calendarViewMode,
      calendarMode: CALENDAR_MODES.has(parsed.calendarMode as CalendarMode)
        ? (parsed.calendarMode as CalendarMode)
        : DEFAULT_EVENT_CALENDAR_PREFERENCES.calendarMode,
      eventOverlapMode: EVENT_OVERLAP_MODES.has(parsed.eventOverlapMode as CalendarEventOverlapMode)
        ? (parsed.eventOverlapMode as CalendarEventOverlapMode)
        : DEFAULT_EVENT_CALENDAR_PREFERENCES.eventOverlapMode,
      linkedScrolling:
        typeof parsed.linkedScrolling === 'boolean'
          ? parsed.linkedScrolling
          : DEFAULT_EVENT_CALENDAR_PREFERENCES.linkedScrolling,
    }
  } catch {
    return { ...DEFAULT_EVENT_CALENDAR_PREFERENCES }
  }
}

export function saveEventCalendarPreferences(preferences: EventCalendarPreferences): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Calendar preferences are optional and must never block the calendar.
  }
}
