const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

type DayName = (typeof DAY_NAMES)[number];

export interface SlaWorkHour {
  timeFrom?: string | null;
  timeTo?: string | null;
}

export type SlaWorkWeek = Partial<Record<DayName, SlaWorkHour | null>>;

export interface SlaHoliday {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  isAllDay?: boolean | null;
}

export interface SlaBusinessCalendar {
  workWeek?: SlaWorkWeek | null;
  holidays?: SlaHoliday[] | null;
  timeZone?: string | null;
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

interface LocalDateTime extends LocalDate {
  hour: number;
  minute: number;
  second: number;
}

interface LocalTime {
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_SCANNED_DAYS = 100_000;

/**
 * Adds SLA hours as elapsed time unless a usable work week is configured. When
 * a work week exists, only its local intervals count and configured holidays
 * are skipped. The IANA time zone defaults to UTC for legacy/configuration
 * safety and daylight-saving transitions are resolved through Intl.
 */
export function addSlaHours(
  baseDate: Date,
  hours: number,
  calendar?: SlaBusinessCalendar | null,
): Date {
  const elapsedDeadline = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
  if (
    !calendar?.workWeek ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    !hasUsableInterval(calendar.workWeek)
  ) {
    return elapsedDeadline;
  }

  const timeZone = normalizeTimeZone(calendar.timeZone);
  const holidayDates = buildHolidayDateSet(calendar.holidays ?? [], timeZone);
  let remainingMilliseconds = hours * 60 * 60 * 1000;
  let cursor = new Date(baseDate);
  let localDate = datePart(toLocalDateTime(cursor, timeZone));

  for (let scannedDays = 0; scannedDays < MAX_SCANNED_DAYS; scannedDays += 1) {
    const dateKey = formatDateKey(localDate);
    const dayName = DAY_NAMES[dayOfWeek(localDate)];
    const interval = calendar.workWeek[dayName];
    const from = parseTime(interval?.timeFrom);
    const to = parseTime(interval?.timeTo);

    if (from && to && !holidayDates.has(dateKey)) {
      const intervalStart = zonedDateTimeToDate(localDate, from, timeZone);
      const intervalEndDate =
        compareTimes(to, from) <= 0 ? addCalendarDays(localDate, 1) : localDate;
      const intervalEnd = zonedDateTimeToDate(intervalEndDate, to, timeZone);
      const effectiveStart = new Date(
        Math.max(cursor.getTime(), intervalStart.getTime()),
      );
      const availableMilliseconds = Math.max(
        0,
        intervalEnd.getTime() - effectiveStart.getTime(),
      );

      if (remainingMilliseconds <= availableMilliseconds) {
        return new Date(effectiveStart.getTime() + remainingMilliseconds);
      }

      remainingMilliseconds -= availableMilliseconds;
      cursor = intervalEnd;
    }

    localDate = addCalendarDays(localDate, 1);
    const nextLocalMidnight = zonedDateTimeToDate(
      localDate,
      { hour: 0, minute: 0, second: 0 },
      timeZone,
    );
    cursor = new Date(Math.max(cursor.getTime(), nextLocalMidnight.getTime()));
  }

  throw new RangeError('SLA deadline exceeds the supported calendar range.');
}

function hasUsableInterval(workWeek: SlaWorkWeek): boolean {
  return DAY_NAMES.some((dayName) => {
    const interval = workWeek[dayName];
    return Boolean(
      parseTime(interval?.timeFrom) && parseTime(interval?.timeTo),
    );
  });
}

function normalizeTimeZone(timeZone: string | null | undefined): string {
  const normalized = timeZone?.trim();
  if (!normalized) {
    return 'UTC';
  }

  try {
    getFormatter(normalized).format(new Date(0));
    return normalized;
  } catch {
    return 'UTC';
  }
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function toLocalDateTime(date: Date, timeZone: string): LocalDateTime {
  const values = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function zonedDateTimeToDate(
  date: LocalDate,
  time: LocalTime,
  timeZone: string,
): Date {
  const desiredAsUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second,
  );
  let timestamp = desiredAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = toLocalDateTime(new Date(timestamp), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = desiredAsUtc - actualAsUtc;
    timestamp += adjustment;
    if (adjustment === 0) {
      break;
    }
  }

  return new Date(timestamp);
}

function parseTime(value: string | null | undefined): LocalTime | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value?.trim() ?? '');
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return { hour, minute, second };
}

function compareTimes(left: LocalTime, right: LocalTime): number {
  return (
    left.hour * 3600 +
    left.minute * 60 +
    left.second -
    (right.hour * 3600 + right.minute * 60 + right.second)
  );
}

function buildHolidayDateSet(
  holidays: SlaHoliday[],
  timeZone: string,
): Set<string> {
  const dates = new Set<string>();

  for (const holiday of holidays) {
    const start = parseDate(holiday.startDate);
    if (!start) {
      continue;
    }

    const end = parseDate(holiday.endDate);
    const inclusiveEnd =
      end && end.getTime() > start.getTime()
        ? new Date(end.getTime() - 1)
        : start;
    let currentDate = holiday.isAllDay
      ? utcDatePart(start)
      : datePart(toLocalDateTime(start, timeZone));
    const endDate = holiday.isAllDay
      ? utcDatePart(inclusiveEnd)
      : datePart(toLocalDateTime(inclusiveEnd, timeZone));

    while (compareDates(currentDate, endDate) <= 0) {
      dates.add(formatDateKey(currentDate));
      currentDate = addCalendarDays(currentDate, 1);
    }
  }

  return dates;
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function datePart(dateTime: LocalDateTime): LocalDate {
  return {
    year: dateTime.year,
    month: dateTime.month,
    day: dateTime.day,
  };
}

function utcDatePart(date: Date): LocalDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addCalendarDays(date: LocalDate, days: number): LocalDate {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return utcDatePart(result);
}

function dayOfWeek(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function compareDates(left: LocalDate, right: LocalDate): number {
  return (
    Date.UTC(left.year, left.month - 1, left.day) -
    Date.UTC(right.year, right.month - 1, right.day)
  );
}

function formatDateKey(date: LocalDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
