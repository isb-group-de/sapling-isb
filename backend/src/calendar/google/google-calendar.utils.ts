import { calendar_v3 } from 'googleapis';
import { EventItem } from '../../entity/EventItem';
import { resolveCalendarEventLocation } from '../calendar-address.utils';
import { buildGoogleRecurrence } from '../calendar.recurrence';
import {
  type CalendarClassificationMapping,
  resolveGoogleCalendarColorId,
} from '../calendar-classification.utils';

export const SAPLING_GOOGLE_EVENT_TYPE_KEY = 'saplingEventType';
export const SAPLING_GOOGLE_EVENT_CATEGORY_KEY = 'saplingEventCategory';

export type ImportGoogleCalendarEventsRange = {
  startDateTime: Date;
  endDateTime: Date;
};

export type GoogleCalendarImportEvent = calendar_v3.Schema$Event & {
  /** First expanded instance returned for a recurring series. */
  saplingImportOccurrence?: {
    start?: calendar_v3.Schema$EventDateTime | null;
    end?: calendar_v3.Schema$EventDateTime | null;
  };
};

/** Limits imports to the still-active part of the requested calendar window. */
export function clampGoogleImportRangeToFuture(
  range: ImportGoogleCalendarEventsRange,
  now: Date = new Date(),
): ImportGoogleCalendarEventsRange | null {
  const startDateTime = new Date(
    Math.max(range.startDateTime.getTime(), now.getTime()),
  );
  if (startDateTime >= range.endDateTime) {
    return null;
  }
  return { startDateTime, endDateTime: range.endDateTime };
}

/** Collapses expanded Google instances back to one series master per import. */
export async function resolveGoogleSeriesImportEvents(
  events: GoogleCalendarImportEvent[],
  loadMaster: (
    recurringEventId: string,
  ) => Promise<GoogleCalendarImportEvent | null>,
): Promise<GoogleCalendarImportEvent[]> {
  const standaloneEvents: GoogleCalendarImportEvent[] = [];
  const recurringEventIds: string[] = [];
  const seenRecurringEventIds = new Set<string>();
  const firstOccurrenceBySeries = new Map<string, GoogleCalendarImportEvent>();

  for (const event of events) {
    const recurringEventId = event.recurringEventId?.trim();
    if (!recurringEventId) {
      standaloneEvents.push(event);
      continue;
    }
    if (!seenRecurringEventIds.has(recurringEventId)) {
      seenRecurringEventIds.add(recurringEventId);
      recurringEventIds.push(recurringEventId);
    }
    const existingOccurrence = firstOccurrenceBySeries.get(recurringEventId);
    const eventStart = normalizeGoogleDateTime(event.start)?.getTime();
    const existingStart = normalizeGoogleDateTime(
      existingOccurrence?.start,
    )?.getTime();
    if (
      !existingOccurrence ||
      (eventStart != null &&
        (existingStart == null || eventStart < existingStart))
    ) {
      firstOccurrenceBySeries.set(recurringEventId, event);
    }
  }

  const masters = await Promise.all(
    recurringEventIds.map((recurringEventId) => loadMaster(recurringEventId)),
  );
  return [
    ...standaloneEvents,
    ...masters.flatMap((event, index) => {
      if (!event) {
        return [];
      }
      const recurringEventId = recurringEventIds[index];
      const firstOccurrence = firstOccurrenceBySeries.get(recurringEventId);
      return [
        {
          ...event,
          id: event.id?.trim() || recurringEventId,
          ...(firstOccurrence?.start
            ? {
                saplingImportOccurrence: {
                  start: firstOccurrence.start,
                  end: firstOccurrence.end,
                },
              }
            : {}),
        },
      ];
    }),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isGoogleAuthenticationError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const status =
    typeof error.status === 'number'
      ? error.status
      : typeof error.code === 'number'
        ? error.code
        : isRecord(error.response) && typeof error.response.status === 'number'
          ? error.response.status
          : undefined;

  if (status === 401 || status === 403) {
    return true;
  }

  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return /token|auth|unauthorized|forbidden/.test(message);
}

export function normalizeGoogleDateTime(
  value?: calendar_v3.Schema$EventDateTime | null,
): Date | null {
  const rawDateTime = value?.dateTime?.trim();
  if (rawDateTime) {
    const date = new Date(rawDateTime);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const rawDate = value?.date?.trim();
  if (!rawDate) {
    return null;
  }

  const date = new Date(`${rawDate}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function truncateGoogleText(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : value.slice(0, maxLength - 3) + '...';
}

export function normalizeGoogleEmail(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^@\s<>]+@[^@\s<>]+$/.test(normalized)
    ? normalized
    : null;
}

export function normalizeGoogleRecurrence(recurrence?: string[] | null): {
  recurrenceRule: string | null;
  exceptionDates: string[];
} {
  let recurrenceRule: string | null = null;
  const exceptionDates: string[] = [];

  for (const line of recurrence ?? []) {
    const trimmed = line.trim();
    if (/^RRULE:/i.test(trimmed) && !recurrenceRule) {
      recurrenceRule = trimmed.slice(trimmed.indexOf(':') + 1).trim() || null;
      continue;
    }
    if (!/^EXDATE(?:;[^:]*)?:/i.test(trimmed)) {
      continue;
    }

    const value = trimmed.slice(trimmed.indexOf(':') + 1);
    for (const part of value.split(',')) {
      const compact = part.trim();
      const dateTimeMatch =
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/i.exec(compact);
      const dateMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(compact);
      const date = dateTimeMatch
        ? new Date(
            Date.UTC(
              Number(dateTimeMatch[1]),
              Number(dateTimeMatch[2]) - 1,
              Number(dateTimeMatch[3]),
              Number(dateTimeMatch[4]),
              Number(dateTimeMatch[5]),
              Number(dateTimeMatch[6]),
            ),
          )
        : dateMatch
          ? new Date(
              Date.UTC(
                Number(dateMatch[1]),
                Number(dateMatch[2]) - 1,
                Number(dateMatch[3]),
              ),
            )
          : null;
      if (date && !Number.isNaN(date.getTime())) {
        exceptionDates.push(date.toISOString());
      }
    }
  }

  return {
    recurrenceRule,
    exceptionDates: Array.from(new Set(exceptionDates)).sort(),
  };
}

export function buildGoogleCalendarEvent(
  event: EventItem,
  classificationMappings?: CalendarClassificationMapping[] | null,
  conferenceRequestId?: string,
): calendar_v3.Schema$Event {
  const colorId = resolveGoogleCalendarColorId(event, classificationMappings);
  const location = resolveCalendarEventLocation(event);

  const resource: calendar_v3.Schema$Event = {
    summary: event.title,
    description: event.description,
    start: { dateTime: event.startDate.toISOString() },
    end: { dateTime: event.endDate.toISOString() },
    recurrence: buildGoogleRecurrence(
      event.recurrenceRule,
      event.recurrenceExceptionDates,
      event.isAllDay,
    ),
    colorId,
    extendedProperties: {
      private: {
        [SAPLING_GOOGLE_EVENT_TYPE_KEY]: event.type?.handle ?? '',
        [SAPLING_GOOGLE_EVENT_CATEGORY_KEY]: event.category?.handle ?? '',
      },
    },
    attendees: event.participants?.map((participant) => ({
      email: participant.email,
      displayName: `${participant.firstName} ${participant.lastName}`,
    })),
    ...(location ? { location } : {}),
  };

  if (event.createOnlineMeeting && conferenceRequestId) {
    resource.conferenceData = {
      createRequest: {
        requestId: conferenceRequestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  return resource;
}

export function isGoogleNotFoundError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const status =
    typeof error.status === 'number'
      ? error.status
      : typeof error.code === 'number'
        ? error.code
        : isRecord(error.response) && typeof error.response.status === 'number'
          ? error.response.status
          : undefined;
  return status === 404 || status === 410;
}

export function buildGoogleCalendarEventPatch(
  event: EventItem,
  classificationMappings?: CalendarClassificationMapping[] | null,
  changedFields?: string[],
  conferenceRequestId?: string,
): {
  patch: calendar_v3.Schema$Event;
  sendUpdates: 'all' | 'none';
} {
  const eventResource = buildGoogleCalendarEvent(
    event,
    classificationMappings,
    conferenceRequestId,
  );
  if (!changedFields) {
    return { patch: eventResource, sendUpdates: 'all' };
  }

  const changed = new Set(changedFields);
  const patch: calendar_v3.Schema$Event = {};
  const copy = (target: keyof calendar_v3.Schema$Event) => {
    if (typeof eventResource[target] !== 'undefined') {
      patch[target] = eventResource[target] as never;
    }
  };

  if (changed.has('title')) copy('summary');
  if (changed.has('description')) copy('description');
  if (changed.has('startDate')) copy('start');
  if (changed.has('endDate')) copy('end');
  if (
    changed.has('recurrenceRule') ||
    changed.has('recurrenceExceptionDates')
  ) {
    copy('recurrence');
  }
  if (changed.has('participants')) copy('attendees');
  if (changed.has('createOnlineMeeting') && event.createOnlineMeeting) {
    copy('conferenceData');
  }
  if (changed.has('type') || changed.has('category')) {
    copy('colorId');
    copy('extendedProperties');
  }
  if (changed.has('creatorCompany')) copy('location');

  const attendeeVisibleFields = [
    'summary',
    'description',
    'start',
    'end',
    'recurrence',
    'attendees',
    'location',
  ];
  const sendUpdates = attendeeVisibleFields.some((field) => field in patch)
    ? 'all'
    : 'none';

  return { patch, sendUpdates };
}
