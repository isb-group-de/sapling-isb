import {
  addCalendarDays,
  fromCalendarDateTime,
  normalizeCalendarTimeZone,
  toCalendarDateTime,
  type CalendarDateTime,
} from './calendar-time-zone.utils';
import type {
  ParsedRecurrenceRule,
  RecurrenceWeekdayCode,
} from './calendar.recurrence';

export function getNextOccurrenceStart(
  currentStart: Date,
  parsedRule: ParsedRecurrenceRule,
  baseStart: Date,
  timeZone = 'UTC',
): Date | null {
  const normalizedTimeZone = normalizeCalendarTimeZone(timeZone);
  switch (parsedRule.frequency) {
    case 'DAILY':
      return addCalendarDays(
        currentStart,
        parsedRule.interval,
        normalizedTimeZone,
      );
    case 'WEEKLY':
      return advanceWeeklyOccurrence(
        currentStart,
        parsedRule,
        baseStart,
        normalizedTimeZone,
      );
    case 'MONTHLY':
      return advanceMonthlyOccurrence(
        currentStart,
        parsedRule.interval,
        baseStart,
        normalizedTimeZone,
      );
    case 'YEARLY':
      return advanceYearlyOccurrence(
        currentStart,
        parsedRule.interval,
        baseStart,
        normalizedTimeZone,
      );
    default:
      return null;
  }
}

export function toWeekdayCode(date: Date): RecurrenceWeekdayCode {
  const weekdayIndex = date.getUTCDay();

  switch (weekdayIndex) {
    case 0:
      return 'SU';
    case 1:
      return 'MO';
    case 2:
      return 'TU';
    case 3:
      return 'WE';
    case 4:
      return 'TH';
    case 5:
      return 'FR';
    case 6:
      return 'SA';
    default:
      return 'MO';
  }
}

function advanceWeeklyOccurrence(
  currentStart: Date,
  parsedRule: ParsedRecurrenceRule,
  baseStart: Date,
  timeZone: string,
): Date | null {
  const allowedWeekdays =
    parsedRule.byDay.length > 0
      ? parsedRule.byDay
      : [toZonedWeekdayCode(baseStart, timeZone)];
  let candidate = new Date(currentStart);

  for (let index = 0; index < 370; index += 1) {
    candidate = addCalendarDays(candidate, 1, timeZone);
    if (
      allowedWeekdays.includes(toZonedWeekdayCode(candidate, timeZone)) &&
      diffZonedWeeksFromMonday(baseStart, candidate, timeZone) %
        parsedRule.interval ===
        0
    ) {
      return candidate;
    }
  }

  return null;
}

function advanceMonthlyOccurrence(
  currentStart: Date,
  interval: number,
  baseStart: Date,
  timeZone: string,
): Date | null {
  const currentParts = toCalendarDateTime(currentStart, timeZone);
  const baseParts = toCalendarDateTime(baseStart, timeZone);
  for (
    let monthsToAdd = interval;
    monthsToAdd <= 1200;
    monthsToAdd += interval
  ) {
    const candidate = createZonedDateWithBaseTime(
      currentParts.year,
      currentParts.month - 1 + monthsToAdd,
      baseParts.day,
      baseParts,
      timeZone,
    );
    if (toCalendarDateTime(candidate, timeZone).day === baseParts.day) {
      return candidate;
    }
  }

  return null;
}

function advanceYearlyOccurrence(
  currentStart: Date,
  interval: number,
  baseStart: Date,
  timeZone: string,
): Date | null {
  const currentParts = toCalendarDateTime(currentStart, timeZone);
  const baseParts = toCalendarDateTime(baseStart, timeZone);
  for (let yearsToAdd = interval; yearsToAdd <= 200; yearsToAdd += interval) {
    const candidate = createZonedDateWithBaseTime(
      currentParts.year + yearsToAdd,
      baseParts.month - 1,
      baseParts.day,
      baseParts,
      timeZone,
    );
    const candidateParts = toCalendarDateTime(candidate, timeZone);
    if (
      candidateParts.month === baseParts.month &&
      candidateParts.day === baseParts.day
    ) {
      return candidate;
    }
  }

  return null;
}

function diffZonedWeeksFromMonday(
  baseDate: Date,
  candidateDate: Date,
  timeZone: string,
): number {
  const millisecondsPerWeek = 604_800_000;
  return Math.floor(
    (startOfZonedWeekMonday(candidateDate, timeZone) -
      startOfZonedWeekMonday(baseDate, timeZone)) /
      millisecondsPerWeek,
  );
}

function startOfZonedWeekMonday(date: Date, timeZone: string): number {
  const parts = toCalendarDateTime(date, timeZone);
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = localDate.getUTCDay();
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day + (day === 0 ? -6 : 1 - day),
  );
}

function createZonedDateWithBaseTime(
  year: number,
  month: number,
  day: number,
  baseTime: CalendarDateTime,
  timeZone: string,
): Date {
  const normalizedLocalDate = new Date(
    Date.UTC(
      year,
      month,
      day,
      baseTime.hour,
      baseTime.minute,
      baseTime.second,
      baseTime.millisecond,
    ),
  );
  return fromCalendarDateTime(
    {
      year: normalizedLocalDate.getUTCFullYear(),
      month: normalizedLocalDate.getUTCMonth() + 1,
      day: normalizedLocalDate.getUTCDate(),
      hour: normalizedLocalDate.getUTCHours(),
      minute: normalizedLocalDate.getUTCMinutes(),
      second: normalizedLocalDate.getUTCSeconds(),
      millisecond: normalizedLocalDate.getUTCMilliseconds(),
    },
    timeZone,
  );
}

function toZonedWeekdayCode(
  date: Date,
  timeZone: string,
): RecurrenceWeekdayCode {
  const parts = toCalendarDateTime(date, timeZone);
  return toWeekdayCode(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day)),
  );
}
