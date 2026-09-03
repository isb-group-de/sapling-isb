export type CalendarDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function normalizeCalendarTimeZone(
  timeZone: string | null | undefined,
): string {
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

export function toCalendarDateTime(
  date: Date,
  timeZone: string,
): CalendarDateTime {
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
    millisecond: date.getUTCMilliseconds(),
  };
}

export function fromCalendarDateTime(
  value: CalendarDateTime,
  timeZone: string,
): Date {
  const desiredAsUtc = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.millisecond,
  );
  let timestamp = desiredAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = toCalendarDateTime(new Date(timestamp), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      actual.millisecond,
    );
    const adjustment = desiredAsUtc - actualAsUtc;
    timestamp += adjustment;
    if (adjustment === 0) {
      break;
    }
  }

  return new Date(timestamp);
}

export function addCalendarDays(
  date: Date,
  days: number,
  timeZone: string,
): Date {
  const parts = toCalendarDateTime(date, timeZone);
  const shifted = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + days,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ),
  );

  return fromCalendarDateTime(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
      millisecond: shifted.getUTCMilliseconds(),
    },
    timeZone,
  );
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
