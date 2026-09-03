import type { CalendarType } from './eventDate.utils'
import type {
  CalendarEventOverlapMode,
  CalendarMode,
  CalendarViewMode,
} from './eventCalendar.utils'

export type CalendarTimeGridScale = 'standard' | 'double'
export type CalendarTimeRangeMode = 'fullDay' | 'workHours'

export interface EventCalendarPreferences {
  calendarType: CalendarType
  calendarViewMode: CalendarViewMode
  calendarMode: CalendarMode
  eventOverlapMode: CalendarEventOverlapMode
  linkedScrolling: boolean
  timeGridScale: CalendarTimeGridScale
  timeRangeMode: CalendarTimeRangeMode
}

export const DEFAULT_EVENT_CALENDAR_PREFERENCES: EventCalendarPreferences = {
  calendarType: 'workweek',
  calendarViewMode: 'single',
  calendarMode: 'default',
  eventOverlapMode: 'stack',
  linkedScrolling: true,
  timeGridScale: 'standard',
  timeRangeMode: 'fullDay',
}

export const CALENDAR_INTERVAL_HEIGHT_BY_SCALE: Record<CalendarTimeGridScale, number> = {
  standard: 48,
  double: 96,
}

const STORAGE_KEY = 'sapling.calendar.preferences'
const CALENDAR_TYPES = new Set<CalendarType>(['day', 'workweek', 'week', 'month'])
const CALENDAR_VIEW_MODES = new Set<CalendarViewMode>(['single', 'sidebyside'])
const CALENDAR_MODES = new Set<CalendarMode>(['default', 'extended'])
const EVENT_OVERLAP_MODES = new Set<CalendarEventOverlapMode>(['stack', 'column'])
const CALENDAR_TIME_GRID_SCALES = new Set<CalendarTimeGridScale>(['standard', 'double'])
const CALENDAR_TIME_RANGE_MODES = new Set<CalendarTimeRangeMode>(['fullDay', 'workHours'])

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
      timeGridScale: CALENDAR_TIME_GRID_SCALES.has(parsed.timeGridScale as CalendarTimeGridScale)
        ? (parsed.timeGridScale as CalendarTimeGridScale)
        : DEFAULT_EVENT_CALENDAR_PREFERENCES.timeGridScale,
      timeRangeMode: CALENDAR_TIME_RANGE_MODES.has(parsed.timeRangeMode as CalendarTimeRangeMode)
        ? (parsed.timeRangeMode as CalendarTimeRangeMode)
        : DEFAULT_EVENT_CALENDAR_PREFERENCES.timeRangeMode,
    }
  } catch {
    return { ...DEFAULT_EVENT_CALENDAR_PREFERENCES }
  }
}

export function resolveCalendarIntervalHeight(scale: CalendarTimeGridScale): number {
  return CALENDAR_INTERVAL_HEIGHT_BY_SCALE[scale]
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
