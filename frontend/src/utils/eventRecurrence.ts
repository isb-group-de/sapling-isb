import type { EventItem } from '@/entity/entity'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { ParsedRecurrenceRule, RecurringCalendarEvent } from './eventRecurrence.types'
import {
  isValidRecurrenceDate as isValidDate,
  parseRecurrenceRule,
  RECURRENCE_MAX_OCCURRENCES,
  weekdayCodeFromDate,
} from './eventRecurrenceRule'

export {
  buildRecurrenceRule,
  parseRecurrenceRule,
  RECURRENCE_MAX_OCCURRENCES,
  weekdayCodeFromDate,
} from './eventRecurrenceRule'

export type {
  ParsedRecurrenceRule,
  RecurrenceEndMode,
  RecurrenceFrequency,
  RecurrenceRuleInput,
  RecurrenceWeekdayCode,
  RecurringCalendarEvent,
} from './eventRecurrence.types'

const DEFAULT_EVENT_COLOR = '#2196F3'
export const RECURRENCE_BULK_MAX_ITERATIONS = 10_000

export function expandRecurringEvent(
  event: EventItem,
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences = RECURRENCE_MAX_OCCURRENCES,
): RecurringCalendarEvent[] {
  const parsedRule = parseRecurrenceRule(event.recurrenceRule)
  if (!parsedRule) {
    return eventOverlapsRange(event, rangeStart, rangeEnd) ? [toCalendarEvent(event)] : []
  }

  const baseStart = new Date(event.startDate)
  const baseEnd = new Date(event.endDate)
  if (!isValidDate(baseStart) || !isValidDate(baseEnd)) {
    return []
  }

  const occurrences: RecurringCalendarEvent[] = []
  const exceptionTimestamps = new Set(
    normalizeRecurrenceExceptionDates(event.recurrenceExceptionDates)
      .map(toDateTimestamp)
      .filter((value): value is number => value !== null),
  )
  const durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 0)
  let currentStart = new Date(baseStart)
  let currentEnd = new Date(baseEnd)
  let occurrenceIndex = 0
  let iterationCount = 0

  const occurrenceLimit = Math.max(1, Math.min(RECURRENCE_MAX_OCCURRENCES, maxOccurrences))

  while (iterationCount < occurrenceLimit) {
    iterationCount += 1
    occurrenceIndex += 1

    if (parsedRule.count && occurrenceIndex > parsedRule.count) {
      break
    }

    if (parsedRule.until && currentStart.getTime() > parsedRule.until.getTime()) {
      break
    }

    if (
      !exceptionTimestamps.has(currentStart.getTime()) &&
      rangesOverlap(currentStart, currentEnd, rangeStart, rangeEnd)
    ) {
      occurrences.push(
        buildRecurringCalendarEvent(event, currentStart, currentEnd, occurrenceIndex),
      )
    }

    if (currentStart.getTime() > rangeEnd.getTime()) {
      break
    }

    const nextOccurrence = getNextOccurrence(currentStart, parsedRule, baseStart, durationMs)
    if (!nextOccurrence) {
      break
    }

    currentStart = nextOccurrence.start
    currentEnd = nextOccurrence.end
  }

  return occurrences
}

export interface RecurrenceOccurrenceStartsThroughResult {
  occurrenceStarts: string[]
  isComplete: boolean
}

export interface FirstGeneratedRecurrenceOccurrenceResult {
  occurrence: RecurringCalendarEvent | null
  isComplete: boolean
}

export function getRecurringEventOccurrenceStartsThrough(
  event: EventItem,
  rangeEnd: Date,
  maxIterations = RECURRENCE_BULK_MAX_ITERATIONS,
): RecurrenceOccurrenceStartsThroughResult {
  const parsedRule = parseRecurrenceRule(event.recurrenceRule)
  const baseStart = new Date(event.startDate)
  if (!parsedRule || !isValidDate(baseStart) || !isValidDate(rangeEnd)) {
    return { occurrenceStarts: [], isComplete: false }
  }

  const exceptionTimestamps = getRecurrenceExceptionTimestamps(event)
  const occurrenceStarts: string[] = []
  let currentStart = new Date(baseStart)
  const iterationLimit = Math.max(1, Math.trunc(maxIterations))

  for (let occurrenceIndex = 1; occurrenceIndex <= iterationLimit; occurrenceIndex += 1) {
    if (parsedRule.count && occurrenceIndex > parsedRule.count) {
      return { occurrenceStarts, isComplete: true }
    }
    if (parsedRule.until && currentStart.getTime() > parsedRule.until.getTime()) {
      return { occurrenceStarts, isComplete: true }
    }
    if (currentStart.getTime() > rangeEnd.getTime()) {
      return { occurrenceStarts, isComplete: true }
    }
    if (!exceptionTimestamps.has(currentStart.getTime())) {
      occurrenceStarts.push(currentStart.toISOString())
    }

    const nextOccurrence = getNextOccurrence(currentStart, parsedRule, baseStart, 0)
    if (!nextOccurrence) {
      return { occurrenceStarts, isComplete: true }
    }
    currentStart = nextOccurrence.start
  }

  return { occurrenceStarts, isComplete: false }
}

export function findFirstGeneratedRecurrenceOccurrence(
  event: EventItem,
  maxIterations = RECURRENCE_BULK_MAX_ITERATIONS,
): FirstGeneratedRecurrenceOccurrenceResult {
  const parsedRule = parseRecurrenceRule(event.recurrenceRule)
  const baseStart = new Date(event.startDate)
  const baseEnd = new Date(event.endDate)
  if (!parsedRule || !isValidDate(baseStart) || !isValidDate(baseEnd)) {
    return { occurrence: null, isComplete: false }
  }

  const exceptionTimestamps = getRecurrenceExceptionTimestamps(event)
  const durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 0)
  let currentStart = new Date(baseStart)
  const iterationLimit = Math.max(1, Math.trunc(maxIterations))

  for (let occurrenceIndex = 1; occurrenceIndex <= iterationLimit; occurrenceIndex += 1) {
    if (parsedRule.count && occurrenceIndex > parsedRule.count) {
      return { occurrence: null, isComplete: true }
    }
    if (parsedRule.until && currentStart.getTime() > parsedRule.until.getTime()) {
      return { occurrence: null, isComplete: true }
    }
    if (!exceptionTimestamps.has(currentStart.getTime())) {
      return {
        occurrence: buildRecurringCalendarEvent(
          event,
          currentStart,
          new Date(currentStart.getTime() + durationMs),
          occurrenceIndex,
        ),
        isComplete: true,
      }
    }

    const nextOccurrence = getNextOccurrence(currentStart, parsedRule, baseStart, durationMs)
    if (!nextOccurrence) {
      return { occurrence: null, isComplete: true }
    }
    currentStart = nextOccurrence.start
  }

  return { occurrence: null, isComplete: false }
}

export function getRecurrenceEndDate({
  recurrenceRule,
  startDate,
  startTime,
  isAllDay,
}: {
  recurrenceRule?: string | null
  startDate?: string | Date | null
  startTime?: string | null
  isAllDay?: boolean
}): Date | null {
  const parsedRule = parseRecurrenceRule(recurrenceRule)
  const baseStart = parseRecurrenceStart(startDate, startTime, isAllDay)

  if (!parsedRule || !baseStart) {
    return null
  }

  if (parsedRule.count) {
    const count = Math.min(parsedRule.count, RECURRENCE_MAX_OCCURRENCES)
    let currentStart = new Date(baseStart)

    for (let index = 1; index < count; index += 1) {
      const nextOccurrence = getNextOccurrence(currentStart, parsedRule, baseStart, 0)
      if (!nextOccurrence) {
        return currentStart
      }

      currentStart = nextOccurrence.start
    }

    return currentStart
  }

  return parsedRule.until ?? null
}

export function isRecurringCalendarEvent(event: CalendarEvent | null | undefined): boolean {
  if (!event) {
    return false
  }

  return Boolean(
    (event as RecurringCalendarEvent).isRecurringOccurrence || event.event?.recurrenceRule,
  )
}

export function toCalendarEvent(event: EventItem): RecurringCalendarEvent {
  return {
    name: event.title,
    color: event.type?.color || DEFAULT_EVENT_COLOR,
    start: new Date(event.startDate).getTime() || 0,
    end: new Date(event.endDate).getTime() || 0,
    timed: event.isAllDay === false,
    event,
  }
}

function buildRecurringCalendarEvent(
  event: EventItem,
  occurrenceStart: Date,
  occurrenceEnd: Date,
  occurrenceIndex: number,
): RecurringCalendarEvent {
  return {
    ...toCalendarEvent(event),
    start: occurrenceStart.getTime(),
    end: occurrenceEnd.getTime(),
    isRecurringOccurrence: true,
    recurrenceOccurrenceIndex: occurrenceIndex,
    recurrenceOccurrenceStart: occurrenceStart.toISOString(),
    recurrenceOccurrenceEnd: occurrenceEnd.toISOString(),
    recurrenceSeriesHandle: event.handle ?? null,
  }
}

function eventOverlapsRange(event: EventItem, rangeStart: Date, rangeEnd: Date): boolean {
  return rangesOverlap(new Date(event.startDate), new Date(event.endDate), rangeStart, rangeEnd)
}

function parseRecurrenceStart(
  startDate?: string | Date | null,
  startTime?: string | null,
  isAllDay?: boolean,
): Date | null {
  if (startDate instanceof Date) {
    return isValidDate(startDate) ? new Date(startDate) : null
  }

  if (!startDate) {
    return null
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate.trim())
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    const timeMatch = !isAllDay && startTime ? /^(\d{2}):(\d{2})/.exec(startTime.trim()) : null

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      timeMatch ? Number(timeMatch[1]) : 0,
      timeMatch ? Number(timeMatch[2]) : 0,
      0,
      0,
    )
  }

  const parsedDate = new Date(startDate)
  return isValidDate(parsedDate) ? parsedDate : null
}

function rangesOverlap(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start.getTime() <= rangeEnd.getTime() && end.getTime() >= rangeStart.getTime()
}

function getNextOccurrence(
  currentStart: Date,
  parsedRule: ParsedRecurrenceRule,
  baseStart: Date,
  durationMs: number,
): { start: Date; end: Date } | null {
  switch (parsedRule.frequency) {
    case 'DAILY':
      return buildOccurrence(addLocalDays(currentStart, parsedRule.interval), durationMs)
    case 'WEEKLY':
      return advanceWeeklyOccurrence(currentStart, parsedRule, baseStart, durationMs)
    case 'MONTHLY':
      return advanceMonthlyOccurrence(currentStart, parsedRule.interval, baseStart, durationMs)
    case 'YEARLY':
      return advanceYearlyOccurrence(currentStart, parsedRule.interval, baseStart, durationMs)
    default:
      return null
  }
}

function advanceWeeklyOccurrence(
  currentStart: Date,
  parsedRule: ParsedRecurrenceRule,
  baseStart: Date,
  durationMs: number,
): { start: Date; end: Date } | null {
  const allowedWeekdays =
    parsedRule.byDay.length > 0 ? parsedRule.byDay : [weekdayCodeFromDate(baseStart)]
  let candidate = new Date(currentStart)

  for (let index = 0; index < 370; index += 1) {
    candidate = addLocalDays(candidate, 1)
    if (candidate.getTime() < baseStart.getTime()) {
      continue
    }

    if (!allowedWeekdays.includes(weekdayCodeFromDate(candidate))) {
      continue
    }

    if (diffLocalWeeksFromMonday(baseStart, candidate) % parsedRule.interval !== 0) {
      continue
    }

    return buildOccurrence(candidate, durationMs)
  }

  return null
}

function advanceMonthlyOccurrence(
  currentStart: Date,
  interval: number,
  baseStart: Date,
  durationMs: number,
): { start: Date; end: Date } | null {
  for (let monthsToAdd = interval; monthsToAdd <= 1200; monthsToAdd += interval) {
    const candidate = createLocalDateWithBaseTime(
      currentStart.getFullYear(),
      currentStart.getMonth() + monthsToAdd,
      baseStart.getDate(),
      baseStart,
    )

    if (candidate.getDate() !== baseStart.getDate()) {
      continue
    }

    return buildOccurrence(candidate, durationMs)
  }

  return null
}

function advanceYearlyOccurrence(
  currentStart: Date,
  interval: number,
  baseStart: Date,
  durationMs: number,
): { start: Date; end: Date } | null {
  for (let yearsToAdd = interval; yearsToAdd <= 200; yearsToAdd += interval) {
    const candidate = createLocalDateWithBaseTime(
      currentStart.getFullYear() + yearsToAdd,
      baseStart.getMonth(),
      baseStart.getDate(),
      baseStart,
    )

    if (
      candidate.getMonth() !== baseStart.getMonth() ||
      candidate.getDate() !== baseStart.getDate()
    ) {
      continue
    }

    return buildOccurrence(candidate, durationMs)
  }

  return null
}

function buildOccurrence(start: Date, durationMs: number) {
  return {
    start,
    end: new Date(start.getTime() + durationMs),
  }
}

function addLocalDays(date: Date, days: number): Date {
  const candidate = new Date(date)
  candidate.setDate(candidate.getDate() + days)
  return candidate
}

function diffLocalWeeksFromMonday(baseDate: Date, candidateDate: Date): number {
  const baseWeekStart = startOfLocalWeekMonday(baseDate)
  const candidateWeekStart = startOfLocalWeekMonday(candidateDate)
  return Math.floor((candidateWeekStart - baseWeekStart) / 604800000)
}

function startOfLocalWeekMonday(date: Date): number {
  const day = date.getDay()
  const delta = day === 0 ? -6 : 1 - day
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}

function createLocalDateWithBaseTime(
  year: number,
  month: number,
  day: number,
  baseTime: Date,
): Date {
  return new Date(
    year,
    month,
    day,
    baseTime.getHours(),
    baseTime.getMinutes(),
    baseTime.getSeconds(),
    baseTime.getMilliseconds(),
  )
}

function normalizeRecurrenceExceptionDates(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedValue)
    return Array.isArray(parsedValue) ? parsedValue : [parsedValue]
  } catch {
    // Legacy records can contain one ISO value instead of a JSON array.
    return [trimmedValue]
  }
}

function getRecurrenceExceptionTimestamps(event: EventItem): Set<number> {
  return new Set(
    normalizeRecurrenceExceptionDates(event.recurrenceExceptionDates)
      .map(toDateTimestamp)
      .filter((value): value is number => value !== null),
  )
}

function toDateTimestamp(value: unknown): number | null {
  if (!(typeof value === 'string' || typeof value === 'number' || value instanceof Date)) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}
