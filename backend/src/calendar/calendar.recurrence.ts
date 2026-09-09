import {
  formatGoogleExceptionDate,
  formatUtcDateOnly,
} from './calendar-recurrence-format.utils';
import {
  getNextOccurrenceStart,
  toWeekdayCode,
} from './calendar-recurrence-progression';

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
  exceptionDates: string[] = [],
  isAllDay = false,
): string[] | [] {
  const parsedRule = parseRecurrenceRule(recurrenceRule);
  if (!parsedRule) {
    return [];
  }

  const exclusions = Array.from(
    new Set(
      exceptionDates
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()))
        .map((value) => formatGoogleExceptionDate(value, isAllDay)),
    ),
  ).sort();

  return [`RRULE:${parsedRule.raw}`, ...exclusions];
}

export interface RecurrenceOccurrenceMatch extends RecurrenceOccurrence {
  occurrenceIndex: number;
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
  timeZone = 'UTC',
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
      timeZone,
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

/** Resolves an exact generated occurrence start without trusting the client. */
export function findRecurrenceOccurrence(
  startDate: Date,
  endDate: Date,
  recurrenceRule: string | null | undefined,
  occurrenceStart: Date,
  maxIterations = 10_000,
  timeZone = 'UTC',
): RecurrenceOccurrenceMatch | null {
  return (
    findRecurrenceOccurrences(
      startDate,
      endDate,
      recurrenceRule,
      [occurrenceStart],
      maxIterations,
      timeZone,
    )?.[0] ?? null
  );
}

/** Resolves a batch with one traversal, preserving the requested order. */
export function findRecurrenceOccurrences(
  startDate: Date,
  endDate: Date,
  recurrenceRule: string | null | undefined,
  occurrenceStarts: Date[],
  maxIterations = 10_000,
  timeZone = 'UTC',
): RecurrenceOccurrenceMatch[] | null {
  const parsedRule = parseRecurrenceRule(recurrenceRule);
  if (
    !parsedRule ||
    occurrenceStarts.length === 0 ||
    [startDate, endDate, ...occurrenceStarts].some((date) =>
      Number.isNaN(date.getTime()),
    ) ||
    occurrenceStarts.some((date) => date.getTime() < startDate.getTime())
  ) {
    return null;
  }

  const durationMilliseconds = Math.max(
    endDate.getTime() - startDate.getTime(),
    0,
  );
  let currentStart = new Date(startDate);
  const pending = new Set(occurrenceStarts.map((date) => date.getTime()));
  const lastRequested = Math.max(...pending);
  const matches = new Map<number, RecurrenceOccurrenceMatch>();

  for (
    let occurrenceIndex = 1;
    occurrenceIndex <= maxIterations;
    occurrenceIndex += 1
  ) {
    if (parsedRule.count && occurrenceIndex > parsedRule.count) {
      return null;
    }
    if (
      parsedRule.until &&
      currentStart.getTime() > parsedRule.until.getTime()
    ) {
      return null;
    }
    if (pending.delete(currentStart.getTime())) {
      matches.set(currentStart.getTime(), {
        occurrenceIndex,
        startDate: new Date(currentStart),
        endDate: new Date(currentStart.getTime() + durationMilliseconds),
      });
      if (pending.size === 0) {
        return occurrenceStarts.map((date) => matches.get(date.getTime())!);
      }
    }
    if (currentStart.getTime() > lastRequested) {
      return null;
    }

    const nextStart = getNextOccurrenceStart(
      currentStart,
      parsedRule,
      startDate,
      timeZone,
    );
    if (!nextStart) {
      return null;
    }
    currentStart = nextStart;
  }

  return null;
}

/**
 * Reports whether a recurring Event has an occurrence overlapping a range.
 * Calendar imports use this before treating an absent provider item as removed.
 */
export function hasRecurrenceOccurrenceInRange(
  startDate: Date,
  endDate: Date,
  recurrenceRule: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  maxIterations = 100_000,
): boolean {
  const parsedRule = parseRecurrenceRule(recurrenceRule);
  if (
    !parsedRule ||
    [startDate, endDate, rangeStart, rangeEnd].some((date) =>
      Number.isNaN(date.getTime()),
    ) ||
    rangeStart >= rangeEnd
  ) {
    return false;
  }

  const durationMilliseconds = Math.max(
    endDate.getTime() - startDate.getTime(),
    0,
  );
  let currentStart = new Date(startDate);

  for (
    let occurrenceIndex = 1;
    occurrenceIndex <= maxIterations;
    occurrenceIndex += 1
  ) {
    if (parsedRule.count && occurrenceIndex > parsedRule.count) {
      return false;
    }
    if (
      parsedRule.until &&
      currentStart.getTime() > parsedRule.until.getTime()
    ) {
      return false;
    }

    const currentEnd = new Date(currentStart.getTime() + durationMilliseconds);
    if (
      currentStart.getTime() < rangeEnd.getTime() &&
      currentEnd.getTime() > rangeStart.getTime()
    ) {
      return true;
    }
    if (currentStart.getTime() >= rangeEnd.getTime()) {
      return false;
    }

    const nextStart = getNextOccurrenceStart(
      currentStart,
      parsedRule,
      startDate,
    );
    if (!nextStart) {
      return false;
    }
    currentStart = nextStart;
  }

  // If a pathological series predates the range by more than the safety cap,
  // do not infer a deletion from an incomplete local calculation.
  return false;
}
