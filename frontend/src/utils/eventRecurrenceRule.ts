import type {
  ParsedRecurrenceRule,
  RecurrenceFrequency,
  RecurrenceRuleInput,
  RecurrenceWeekdayCode,
} from './eventRecurrence.types'

export const RECURRENCE_MAX_OCCURRENCES = 100
const RECURRENCE_FREQUENCIES = new Set<RecurrenceFrequency>([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
])
const RECURRENCE_WEEKDAY_CODES = new Set<RecurrenceWeekdayCode>([
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
])
const WEEKDAY_CODE_BY_JS_DAY: RecurrenceWeekdayCode[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function parseRecurrenceRule(recurrenceRule?: string | null): ParsedRecurrenceRule | null {
  if (typeof recurrenceRule !== 'string' || !recurrenceRule.trim()) return null
  const trimmedRule = recurrenceRule.trim()
  const normalizedRule = trimmedRule.startsWith('RRULE:')
    ? trimmedRule.slice('RRULE:'.length).trim()
    : trimmedRule
  const values = new Map<string, string>()
  normalizedRule
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf('=')
      if (separatorIndex <= 0) return
      const key = part.slice(0, separatorIndex).trim().toUpperCase()
      const value = part.slice(separatorIndex + 1).trim()
      if (key && value) values.set(key, value)
    })

  const frequency = values.get('FREQ')?.toUpperCase() as RecurrenceFrequency | undefined
  if (!frequency || !RECURRENCE_FREQUENCIES.has(frequency)) return null
  const intervalValue = Number.parseInt(values.get('INTERVAL') ?? '1', 10)
  const countValue = Number.parseInt(values.get('COUNT') ?? '', 10)
  const byDay = (values.get('BYDAY') ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase() as RecurrenceWeekdayCode)
    .filter(
      (item, index, items) => RECURRENCE_WEEKDAY_CODES.has(item) && items.indexOf(item) === index,
    )
  const count =
    Number.isFinite(countValue) && countValue > 0
      ? Math.min(RECURRENCE_MAX_OCCURRENCES, countValue)
      : null
  const until = parseCompactUtcDate(values.get('UNTIL'))
  return {
    raw: normalizeRecurrenceRule(normalizedRule),
    frequency,
    interval: Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 1,
    byDay,
    ...(count ? { count } : {}),
    ...(until ? { until } : {}),
  }
}

export function buildRecurrenceRule(input: RecurrenceRuleInput): string | null {
  if (!input || input.frequency === 'NONE') return null
  const frequency = input.frequency.toUpperCase() as RecurrenceFrequency
  if (!RECURRENCE_FREQUENCIES.has(frequency)) return null
  const interval =
    typeof input.interval === 'number' && Number.isFinite(input.interval) && input.interval > 0
      ? Math.trunc(input.interval)
      : 1
  const parts = [`FREQ=${frequency}`, `INTERVAL=${interval}`]
  if (frequency === 'WEEKLY') {
    const weekdays =
      input.weekdays && input.weekdays.length > 0
        ? Array.from(new Set(input.weekdays.filter((day) => RECURRENCE_WEEKDAY_CODES.has(day))))
        : resolveDefaultWeekdays(input.startDate)
    if (weekdays.length > 0) parts.push(`BYDAY=${weekdays.join(',')}`)
  }
  if (input.endMode === 'count') {
    const count =
      typeof input.count === 'number' && Number.isFinite(input.count)
        ? Math.max(1, Math.min(RECURRENCE_MAX_OCCURRENCES, Math.trunc(input.count)))
        : 1
    parts.push(`COUNT=${count}`)
  }
  if (input.endMode === 'until') {
    const until = formatUntilToCompactUtc(
      input.untilDate,
      input.untilTime,
      input.startTime,
      input.isAllDay,
    )
    if (until) parts.push(`UNTIL=${until}`)
  }
  return parts.join(';')
}

export function weekdayCodeFromDate(date: Date): RecurrenceWeekdayCode {
  return WEEKDAY_CODE_BY_JS_DAY[date.getDay()] ?? 'MO'
}

export function toRecurrenceDate(value?: string | Date | null): Date | null {
  if (value instanceof Date) return isValidRecurrenceDate(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmedValue = value.trim()
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }
  const parsedDate = new Date(trimmedValue)
  return isValidRecurrenceDate(parsedDate) ? parsedDate : null
}

export function isValidRecurrenceDate(date: Date): boolean {
  return !Number.isNaN(date.getTime())
}

function resolveDefaultWeekdays(startDate?: string | Date | null): RecurrenceWeekdayCode[] {
  const date = toRecurrenceDate(startDate)
  return date ? [weekdayCodeFromDate(date)] : []
}

function formatUntilToCompactUtc(
  untilDate?: string | null,
  untilTime?: string | null,
  startTime?: string | null,
  isAllDay?: boolean,
): string | null {
  if (typeof untilDate !== 'string' || !untilDate.trim()) return null
  const timeSource = isAllDay ? '23:59' : untilTime?.trim() || startTime?.trim() || '23:59'
  const localDateTime = toLocalDateTime(untilDate.trim(), timeSource)
  if (!localDateTime) return null
  return [
    localDateTime.getUTCFullYear(),
    String(localDateTime.getUTCMonth() + 1).padStart(2, '0'),
    String(localDateTime.getUTCDate()).padStart(2, '0'),
    'T',
    String(localDateTime.getUTCHours()).padStart(2, '0'),
    String(localDateTime.getUTCMinutes()).padStart(2, '0'),
    String(localDateTime.getUTCSeconds()).padStart(2, '0'),
    'Z',
  ].join('')
}

function toLocalDateTime(dateValue: string, timeValue: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue)
  if (!dateMatch || !timeMatch) return null
  const [, year, month, day] = dateMatch
  const [, hours, minutes, seconds] = timeMatch
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds ?? '0'),
  )
  return isValidRecurrenceDate(date) ? date : null
}

function parseCompactUtcDate(value?: string): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value.trim().toUpperCase())
  if (!match) return undefined
  const [, year, month, day, hours, minutes, seconds] = match
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    ),
  )
}

function normalizeRecurrenceRule(rule: string): string {
  return rule
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(';')
}
