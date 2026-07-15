import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type RecurrenceEndMode = 'never' | 'until' | 'count'
export type RecurrenceWeekdayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface ParsedRecurrenceRule {
  raw: string
  frequency: RecurrenceFrequency
  interval: number
  byDay: RecurrenceWeekdayCode[]
  count?: number
  until?: Date
}

export interface RecurrenceRuleInput {
  frequency: RecurrenceFrequency | 'NONE'
  interval?: number | null
  weekdays?: RecurrenceWeekdayCode[]
  endMode?: RecurrenceEndMode
  count?: number | null
  untilDate?: string | null
  untilTime?: string | null
  startDate?: string | Date | null
  startTime?: string | null
  isAllDay?: boolean
}

export type RecurringCalendarEvent = CalendarEvent & {
  isRecurringOccurrence?: boolean
  recurrenceOccurrenceIndex?: number
  recurrenceOccurrenceStart?: string
  recurrenceOccurrenceEnd?: string
  recurrenceSeriesHandle?: number | null
}
