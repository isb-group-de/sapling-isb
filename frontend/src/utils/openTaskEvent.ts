import type { EventItem } from '@/entity/entity'
import { expandRecurringEvent } from '@/utils/eventRecurrence'

export interface OpenTaskEventOccurrence {
  startDate: Date
  endDate: Date
  recurrenceOccurrenceStart: string | null
}

/**
 * Resolves the first still-generated occurrence represented by an open Event.
 * Detached occurrences are listed in recurrenceExceptionDates and are skipped,
 * so completing one occurrence naturally advances the Inbox to the next one.
 */
export function getOpenTaskEventOccurrence(event: EventItem): OpenTaskEventOccurrence | null {
  const startDate = toValidDate(event.startDate)
  if (!startDate) {
    return null
  }
  const endDate = toValidDate(event.endDate) ?? startDate

  if (!event.recurrenceRule?.trim()) {
    return {
      startDate,
      endDate,
      recurrenceOccurrenceStart: null,
    }
  }

  const occurrence = expandRecurringEvent(event, startDate, new Date(8640000000000000))[0]
  if (!occurrence || typeof occurrence.start !== 'number' || typeof occurrence.end !== 'number') {
    return null
  }

  const occurrenceStart = new Date(occurrence.start)
  const occurrenceEnd = new Date(occurrence.end)
  if (!Number.isFinite(occurrenceStart.getTime()) || !Number.isFinite(occurrenceEnd.getTime())) {
    return null
  }

  return {
    startDate: occurrenceStart,
    endDate: occurrenceEnd,
    recurrenceOccurrenceStart:
      occurrence.recurrenceOccurrenceStart ?? occurrenceStart.toISOString(),
  }
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
