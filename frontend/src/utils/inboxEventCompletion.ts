import type { EventItem } from '@/entity/entity'
import { getRecurringEventOccurrenceStartsThrough } from '@/utils/eventRecurrence'
import { getOpenTaskEventOccurrence } from '@/utils/openTaskEvent'

export interface EventCompletionTarget {
  handle: string | number
  expectedUpdatedAt?: string
}

export interface RecurringEventCompletionTarget {
  event: EventItem
  occurrenceStarts: string[]
}

export interface EventCompletionPlan {
  standaloneEvents: EventItem[]
  recurringEvents: RecurringEventCompletionTarget[]
  completionCount: number
  isComplete: boolean
}

export function getDefaultEventCompletionCutoff(now = new Date()): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return formatLocalDate(yesterday)
}

export function isValidEventCompletionCutoff(value: string, now = new Date()): boolean {
  const cutoff = parseLocalDateEndOfDay(value)
  if (!cutoff) {
    return false
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return cutoff.getTime() < todayStart.getTime()
}

export function selectOverdueEventsThroughDate(
  events: EventItem[],
  cutoffValue: string,
  now = new Date(),
): EventItem[] {
  const cutoff = parseLocalDateEndOfDay(cutoffValue)
  if (!cutoff || !isValidEventCompletionCutoff(cutoffValue, now)) {
    return []
  }

  return events.filter((event) => {
    if (event.handle == null) {
      return false
    }

    const occurrence = getOpenTaskEventOccurrence(event)
    return occurrence != null && occurrence.startDate.getTime() <= cutoff.getTime()
  })
}

export function buildEventCompletionTargetChunks(
  events: EventItem[],
  chunkSize = 200,
): EventCompletionTarget[][] {
  const normalizedChunkSize = Math.max(1, Math.trunc(chunkSize))
  const targets = events.flatMap((event): EventCompletionTarget[] => {
    if (event.handle == null) {
      return []
    }

    const expectedUpdatedAt = normalizeUpdatedAt(event.updatedAt)
    return [
      {
        handle: event.handle,
        ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
      },
    ]
  })

  const chunks: EventCompletionTarget[][] = []
  for (let index = 0; index < targets.length; index += normalizedChunkSize) {
    chunks.push(targets.slice(index, index + normalizedChunkSize))
  }
  return chunks
}

export function buildEventCompletionPlan(
  events: EventItem[],
  cutoffValue: string,
  now = new Date(),
): EventCompletionPlan {
  const cutoff = parseLocalDateEndOfDay(cutoffValue)
  const candidates = selectOverdueEventsThroughDate(events, cutoffValue, now)
  if (!cutoff) {
    return {
      standaloneEvents: [],
      recurringEvents: [],
      completionCount: 0,
      isComplete: false,
    }
  }

  const standaloneEvents: EventItem[] = []
  const recurringEvents: RecurringEventCompletionTarget[] = []
  let isComplete = true

  for (const event of candidates) {
    if (!event.recurrenceRule?.trim()) {
      standaloneEvents.push(event)
      continue
    }

    const recurrence = getRecurringEventOccurrenceStartsThrough(event, cutoff)
    recurringEvents.push({
      event,
      occurrenceStarts: recurrence.occurrenceStarts,
    })
    isComplete = isComplete && recurrence.isComplete
  }

  return {
    standaloneEvents,
    recurringEvents,
    completionCount:
      standaloneEvents.length +
      recurringEvents.reduce((count, item) => count + item.occurrenceStarts.length, 0),
    isComplete,
  }
}

export function appendEventRecurrenceExceptions(
  event: EventItem,
  occurrenceStarts: string[],
): EventItem {
  const existingExceptions = normalizeRecurrenceExceptionDates(event.recurrenceExceptionDates)
  return {
    ...event,
    recurrenceExceptionDates: Array.from(
      new Set([
        ...existingExceptions,
        ...occurrenceStarts.map((value) => new Date(value).toISOString()),
      ]),
    ).sort(),
    updatedAt: undefined,
  }
}

export function getEventExpectedUpdatedAt(event: EventItem): string | undefined {
  return normalizeUpdatedAt(event.updatedAt) ?? undefined
}

function parseLocalDateEndOfDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null
  }

  return parsed
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function normalizeUpdatedAt(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function normalizeRecurrenceExceptionDates(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeDateString(item))
  }
  if (typeof value !== 'string') {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.flatMap((item) => normalizeDateString(item)) : []
  } catch {
    return normalizeDateString(value)
  }
}

function normalizeDateString(value: unknown): string[] {
  if (!(typeof value === 'string' || typeof value === 'number' || value instanceof Date)) {
    return []
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? [date.toISOString()] : []
}
