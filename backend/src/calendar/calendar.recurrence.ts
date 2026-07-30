export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type RecurrenceWeekdayCode =
  'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface ParsedRecurrenceRule {
  raw: string;
  frequency: RecurrenceFrequency;
  interval: number;
  byDay: RecurrenceWeekdayCode[];
  count?: number;
  until?: Date;
}

export interface RecurrenceOccurrence {
  startDate: Date;
  endDate: Date;
}

export interface ExpandedFiniteRecurrence {
  occurrences: RecurrenceOccurrence[];
  isFinite: boolean;
  isComplete: boolean;
}

export const RECURRENCE_MAX_OCCURRENCES = 100;

const RECURRENCE_FREQUENCIES = new Set<RecurrenceFrequency>([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
]);

const RECURRENCE_WEEKDAY_CODES = new Set<RecurrenceWeekdayCode>([
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
]);

const GRAPH_WEEKDAY_BY_CODE: Record<RecurrenceWeekdayCode, string> = {
  MO: 'monday',
  TU: 'tuesday',
  WE: 'wednesday',
  TH: 'thursday',
  FR: 'friday',
  SA: 'saturday',
  SU: 'sunday',
};

export function parseRecurrenceRule(
  recurrenceRule?: string | null,
): ParsedRecurrenceRule | null {
  if (typeof recurrenceRule !== 'string') {
    return null;
  }

  const trimmedRule = recurrenceRule.trim();
  if (!trimmedRule) {
    return null;
  }

  const normalizedRule = trimmedRule.startsWith('RRULE:')
    ? trimmedRule.slice('RRULE:'.length).trim()
    : trimmedRule;
  const parts = normalizedRule.split(';').map((part) => part.trim());
  const values = new Map<string, string>();

  for (const part of parts) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim().toUpperCase();
    const value = part.slice(separatorIndex + 1).trim();
    if (key && value) {
      values.set(key, value);
    }
  }

  const frequencyValue = values.get('FREQ')?.toUpperCase() as
    RecurrenceFrequency | undefined;
  if (!frequencyValue || !RECURRENCE_FREQUENCIES.has(frequencyValue)) {
    return null;
  }

  const intervalValue = Number.parseInt(values.get('INTERVAL') ?? '1', 10);
  const interval =
    Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 1;

  const countValue = values.get('COUNT');
  const count = countValue ? Number.parseInt(countValue, 10) : undefined;

  const until = parseCompactUtcDate(values.get('UNTIL'));
  const byDay = parseByDay(values.get('BYDAY'));

  return {
    raw: normalizeRecurrenceRule(normalizedRule),
    frequency: frequencyValue,
    interval,
    byDay,
    ...(typeof count === 'number' && Number.isFinite(count) && count > 0
      ? { count }
      : {}),
    ...(until ? { until } : {}),
  };
}

export function buildGoogleRecurrence(
  recurrenceRule?: string | null,
): string[] | [] {
  const parsedRule = parseRecurrenceRule(recurrenceRule);
  return parsedRule ? [`RRULE:${parsedRule.raw}`] : [];
}

export function buildAzureRecurrence(
  startDate: Date,
  recurrenceRule?: string | null,
): Record<string, unknown> | null {
  const parsedRule = parseRecurrenceRule(recurrenceRule);
  if (!parsedRule) {
    return null;
  }

  const pattern = buildAzurePattern(startDate, parsedRule);
  if (!pattern) {
    return null;
  }

  return {
    pattern,
    range: buildAzureRange(startDate, parsedRule),
  };
}

/**
 * Expands a stored recurrence into standalone occurrence ranges.
 *
 * The result explicitly reports open-ended and over-limit series so callers
 * that materialize records can reject them instead of silently creating only
 * a partial series.
 */
export function expandFiniteRecurrence(
  startDate: Date,
  endDate: Date,
  recurrenceRule?: string | null,
  maxOccurrences = RECURRENCE_MAX_OCCURRENCES,
): ExpandedFiniteRecurrence {
  const parsedRule = parseRecurrenceRule(recurrenceRule);
  if (
    !parsedRule ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return { occurrences: [], isFinite: false, isComplete: false };
  }

  const isFinite =
    typeof parsedRule.count === 'number' || parsedRule.until instanceof Date;
  if (!isFinite) {
    return { occurrences: [], isFinite: false, isComplete: false };
  }

  const occurrenceLimit = Math.max(
    1,
    Math.min(RECURRENCE_MAX_OCCURRENCES, maxOccurrences),
  );
  const durationMilliseconds = Math.max(
    endDate.getTime() - startDate.getTime(),
    0,
  );
  const occurrences: RecurrenceOccurrence[] = [];
  let currentStart = new Date(startDate);

  while (occurrences.length <= occurrenceLimit) {
    const occurrenceIndex = occurrences.length + 1;
    if (parsedRule.count && occurrenceIndex > parsedRule.count) {
      return { occurrences, isFinite: true, isComplete: true };
    }
    if (
      parsedRule.until &&
      currentStart.getTime() > parsedRule.until.getTime()
    ) {
      return { occurrences, isFinite: true, isComplete: true };
    }

    occurrences.push({
      startDate: new Date(currentStart),
      endDate: new Date(currentStart.getTime() + durationMilliseconds),
    });

    const nextStart = getNextOccurrenceStart(
      currentStart,
      parsedRule,
      startDate,
    );
    if (!nextStart) {
      return { occurrences, isFinite: true, isComplete: true };
    }
    currentStart = nextStart;
  }

  return {
    occurrences: occurrences.slice(0, occurrenceLimit),
    isFinite: true,
    isComplete: false,
  };
}

function buildAzurePattern(
  startDate: Date,
  parsedRule: ParsedRecurrenceRule,
): Record<string, unknown> | null {
  switch (parsedRule.frequency) {
    case 'DAILY':
      return {
        type: 'daily',
        interval: parsedRule.interval,
      };
    case 'WEEKLY':
      return {
        type: 'weekly',
        interval: parsedRule.interval,
        daysOfWeek: (parsedRule.byDay.length > 0
          ? parsedRule.byDay
          : [toWeekdayCode(startDate)]
        ).map((weekday) => GRAPH_WEEKDAY_BY_CODE[weekday]),
        firstDayOfWeek: 'monday',
      };
    case 'MONTHLY':
      return {
        type: 'absoluteMonthly',
        interval: parsedRule.interval,
        dayOfMonth: startDate.getUTCDate(),
      };
    case 'YEARLY':
      return {
        type: 'absoluteYearly',
        interval: parsedRule.interval,
        dayOfMonth: startDate.getUTCDate(),
        month: startDate.getUTCMonth() + 1,
      };
    default:
      return null;
  }
}

function buildAzureRange(
  startDate: Date,
  parsedRule: ParsedRecurrenceRule,
): Record<string, unknown> {
  const baseRange = {
    startDate: formatUtcDateOnly(startDate),
    recurrenceTimeZone: 'UTC',
  };

  if (typeof parsedRule.count === 'number' && parsedRule.count > 0) {
    return {
      type: 'numbered',
      ...baseRange,
      numberOfOccurrences: parsedRule.count,
    };
  }

  if (parsedRule.until) {
    return {
      type: 'endDate',
      ...baseRange,
      endDate: formatUtcDateOnly(parsedRule.until),
    };
  }

  return {
    type: 'noEnd',
    ...baseRange,
  };
}

function parseByDay(value?: string): RecurrenceWeekdayCode[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim().toUpperCase() as RecurrenceWeekdayCode)
    .filter(
      (item, index, items) =>
        RECURRENCE_WEEKDAY_CODES.has(item) && items.indexOf(item) === index,
    );
}

function parseCompactUtcDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim().toUpperCase();
  const fullMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(
    normalizedValue,
  );

  if (fullMatch) {
    const [, year, month, day, hours, minutes, seconds] = fullMatch;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ),
    );
  }

  const dateMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(normalizedValue);
  if (!dateMatch) {
    return undefined;
  }

  const [, year, month, day] = dateMatch;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0),
  );
}

function normalizeRecurrenceRule(rule: string): string {
  return rule
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(';');
}

function formatUtcDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function toWeekdayCode(date: Date): RecurrenceWeekdayCode {
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

function getNextOccurrenceStart(
  currentStart: Date,
  parsedRule: ParsedRecurrenceRule,
  baseStart: Date,
): Date | null {
  switch (parsedRule.frequency) {
    case 'DAILY':
      return addUtcDays(currentStart, parsedRule.interval);
    case 'WEEKLY':
      return advanceWeeklyOccurrence(currentStart, parsedRule, baseStart);
    case 'MONTHLY':
      return advanceMonthlyOccurrence(
        currentStart,
        parsedRule.interval,
        baseStart,
      );
    case 'YEARLY':
      return advanceYearlyOccurrence(
        currentStart,
        parsedRule.interval,
        baseStart,
      );
    default:
      return null;
  }
}

function advanceWeeklyOccurrence(
  currentStart: Date,
  parsedRule: ParsedRecurrenceRule,
  baseStart: Date,
): Date | null {
  const allowedWeekdays =
    parsedRule.byDay.length > 0 ? parsedRule.byDay : [toWeekdayCode(baseStart)];
  let candidate = new Date(currentStart);

  for (let index = 0; index < 370; index += 1) {
    candidate = addUtcDays(candidate, 1);
    if (
      allowedWeekdays.includes(toWeekdayCode(candidate)) &&
      diffWeeksFromMonday(baseStart, candidate) % parsedRule.interval === 0
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
): Date | null {
  for (
    let monthsToAdd = interval;
    monthsToAdd <= 1200;
    monthsToAdd += interval
  ) {
    const candidate = createUtcDateWithBaseTime(
      currentStart.getUTCFullYear(),
      currentStart.getUTCMonth() + monthsToAdd,
      baseStart.getUTCDate(),
      baseStart,
    );
    if (candidate.getUTCDate() === baseStart.getUTCDate()) {
      return candidate;
    }
  }

  return null;
}

function advanceYearlyOccurrence(
  currentStart: Date,
  interval: number,
  baseStart: Date,
): Date | null {
  for (let yearsToAdd = interval; yearsToAdd <= 200; yearsToAdd += interval) {
    const candidate = createUtcDateWithBaseTime(
      currentStart.getUTCFullYear() + yearsToAdd,
      baseStart.getUTCMonth(),
      baseStart.getUTCDate(),
      baseStart,
    );
    if (
      candidate.getUTCMonth() === baseStart.getUTCMonth() &&
      candidate.getUTCDate() === baseStart.getUTCDate()
    ) {
      return candidate;
    }
  }

  return null;
}

function addUtcDays(date: Date, days: number): Date {
  const candidate = new Date(date);
  candidate.setUTCDate(candidate.getUTCDate() + days);
  return candidate;
}

function diffWeeksFromMonday(baseDate: Date, candidateDate: Date): number {
  const millisecondsPerWeek = 604_800_000;
  return Math.floor(
    (startOfUtcWeekMonday(candidateDate).getTime() -
      startOfUtcWeekMonday(baseDate).getTime()) /
      millisecondsPerWeek,
  );
}

function startOfUtcWeekMonday(date: Date): Date {
  const candidate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = candidate.getUTCDay();
  candidate.setUTCDate(candidate.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return candidate;
}

function createUtcDateWithBaseTime(
  year: number,
  month: number,
  day: number,
  baseTime: Date,
): Date {
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      baseTime.getUTCHours(),
      baseTime.getUTCMinutes(),
      baseTime.getUTCSeconds(),
      baseTime.getUTCMilliseconds(),
    ),
  );
}
