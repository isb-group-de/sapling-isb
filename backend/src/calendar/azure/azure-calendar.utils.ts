import { EventItem } from '../../entity/EventItem';
import { buildAzureRecurrence } from '../calendar.recurrence';
import {
  type CalendarClassificationMapping,
  resolveOutboundCalendarValues,
} from '../calendar-classification.utils';

export type ImportAzureCalendarEventsRange = {
  startDateTime: Date;
  endDateTime: Date;
};

/** Limits imports to the still-active part of the requested calendar window. */
export function clampAzureImportRangeToFuture(
  range: ImportAzureCalendarEventsRange,
  now: Date = new Date(),
): ImportAzureCalendarEventsRange | null {
  const startDateTime = new Date(
    Math.max(range.startDateTime.getTime(), now.getTime()),
  );
  if (startDateTime >= range.endDateTime) {
    return null;
  }
  return { startDateTime, endDateTime: range.endDateTime };
}

type AzureGraphDateTime = {
  dateTime?: string | null;
  timeZone?: string | null;
};

type AzureGraphAttendee = {
  emailAddress?: {
    address?: string | null;
    name?: string | null;
  } | null;
};

export type AzureGraphCalendarEvent = {
  id?: string;
  iCalUId?: string | null;
  type?: 'singleInstance' | 'occurrence' | 'exception' | 'seriesMaster' | null;
  seriesMasterId?: string | null;
  originalStart?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: {
    content?: string | null;
    contentType?: string | null;
  } | null;
  sensitivity?: string | null;
  start?: AzureGraphDateTime | null;
  end?: AzureGraphDateTime | null;
  isAllDay?: boolean | null;
  isCancelled?: boolean | null;
  attendees?: AzureGraphAttendee[] | null;
  categories?: string[] | null;
  isOnlineMeeting?: boolean | null;
  onlineMeetingProvider?: string | null;
  onlineMeetingUrl?: string | null;
  onlineMeeting?: { joinUrl?: string | null } | null;
  locations?: Array<{
    displayName?: string | null;
    locationUri?: string | null;
  }> | null;
  recurrence?: AzureGraphPatternedRecurrence | null;
  /**
   * First expanded occurrence returned by calendarView for a series master.
   * This is internal import metadata and is never sent back to Graph.
   */
  saplingImportOccurrence?: {
    start?: AzureGraphDateTime | null;
    end?: AzureGraphDateTime | null;
  } | null;
};

type AzureGraphPatternedRecurrence = {
  pattern?: {
    type?: string | null;
    interval?: number | null;
    daysOfWeek?: string[] | null;
  } | null;
  range?: {
    type?: string | null;
    endDate?: string | null;
    numberOfOccurrences?: number | null;
  } | null;
};

export type AzureCalendarViewResponse = {
  value?: AzureGraphCalendarEvent[];
  '@odata.nextLink'?: string;
};

export type AzureOutlookCategory = {
  id?: string;
  displayName?: string;
  color?: string;
};

export type AzureOutlookMasterCategory = {
  id?: string;
  displayName: string;
  color?: string;
};

export type AzureOutlookCategoriesResponse = {
  value?: AzureOutlookCategory[];
  '@odata.nextLink'?: string;
};

const AZURE_WEEKDAY_TO_RRULE: Record<string, string> = {
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
  sunday: 'SU',
};

/**
 * calendarView expands recurring events into occurrence/exception resources.
 * Collapse those resources back to their series master before persistence so
 * one Outlook series can only produce one Sapling Event and one provider link.
 */
export async function resolveAzureSeriesImportEvents(
  events: AzureGraphCalendarEvent[],
  loadSeriesMaster: (
    seriesMasterId: string,
  ) => Promise<AzureGraphCalendarEvent | null>,
): Promise<AzureGraphCalendarEvent[]> {
  const resolvedByReference = new Map<string, AzureGraphCalendarEvent>();
  const unkeyedEvents: AzureGraphCalendarEvent[] = [];
  const seriesMasterIds = new Set<string>();
  const firstOccurrenceBySeries = new Map<string, AzureGraphCalendarEvent>();

  for (const event of events) {
    const seriesMasterId = event.seriesMasterId?.trim();
    if (seriesMasterId) {
      seriesMasterIds.add(seriesMasterId);
      const existingOccurrence = firstOccurrenceBySeries.get(seriesMasterId);
      const eventStart = normalizeAzureDateTime(event.start)?.getTime();
      const existingStart = normalizeAzureDateTime(
        existingOccurrence?.start,
      )?.getTime();
      if (
        !existingOccurrence ||
        (eventStart != null &&
          (existingStart == null || eventStart < existingStart))
      ) {
        firstOccurrenceBySeries.set(seriesMasterId, event);
      }
      continue;
    }

    const referenceHandle = event.id?.trim();
    if (referenceHandle) {
      if (!resolvedByReference.has(referenceHandle)) {
        resolvedByReference.set(referenceHandle, event);
      }
    } else {
      unkeyedEvents.push(event);
    }
  }

  await Promise.all(
    [...seriesMasterIds].map(async (seriesMasterId) => {
      if (resolvedByReference.has(seriesMasterId)) {
        return;
      }

      const seriesMaster = await loadSeriesMaster(seriesMasterId);
      if (seriesMaster) {
        const firstOccurrence = firstOccurrenceBySeries.get(seriesMasterId);
        resolvedByReference.set(seriesMasterId, {
          ...seriesMaster,
          id: seriesMaster.id?.trim() || seriesMasterId,
          type: seriesMaster.type ?? 'seriesMaster',
          seriesMasterId: null,
          ...(firstOccurrence?.start
            ? {
                saplingImportOccurrence: {
                  start: firstOccurrence.start,
                  end: firstOccurrence.end,
                },
              }
            : {}),
        });
      }
    }),
  );

  return [...resolvedByReference.values(), ...unkeyedEvents];
}

/** Maps the recurrence subset supported by Sapling back to its RRULE form. */
export function normalizeAzureRecurrenceRule(
  recurrence?: AzureGraphPatternedRecurrence | null,
): string | null {
  const pattern = recurrence?.pattern;
  const range = recurrence?.range;
  if (!pattern?.type) {
    return null;
  }

  const frequencyByPattern: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    absoluteMonthly: 'MONTHLY',
    absoluteYearly: 'YEARLY',
  };
  const frequency = frequencyByPattern[pattern.type];
  if (!frequency) {
    return null;
  }

  const parts = [`FREQ=${frequency}`];
  const interval = Math.max(1, Math.trunc(pattern.interval ?? 1));
  parts.push(`INTERVAL=${interval}`);

  if (frequency === 'WEEKLY') {
    const weekdays = (pattern.daysOfWeek ?? [])
      .map((day) => AZURE_WEEKDAY_TO_RRULE[day.toLowerCase()])
      .filter((day): day is string => Boolean(day));
    if (weekdays.length > 0) {
      parts.push(`BYDAY=${weekdays.join(',')}`);
    }
  }

  if (
    range?.type === 'numbered' &&
    typeof range.numberOfOccurrences === 'number' &&
    range.numberOfOccurrences > 0
  ) {
    parts.push(`COUNT=${Math.trunc(range.numberOfOccurrences)}`);
  } else if (
    range?.type === 'endDate' &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.endDate ?? '')
  ) {
    parts.push(`UNTIL=${range.endDate!.replace(/-/g, '')}T235959Z`);
  }

  return parts.join(';');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAzureAuthenticationError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const status =
    typeof error.statusCode === 'number'
      ? error.statusCode
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

export function isAzureForbiddenError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return (
    error.statusCode === 403 ||
    (isRecord(error.response) && error.response.status === 403)
  );
}

export function isAzureNotFoundError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const status =
    typeof error.statusCode === 'number'
      ? error.statusCode
      : isRecord(error.response) && typeof error.response.status === 'number'
        ? error.response.status
        : undefined;
  if (status === 404) {
    return true;
  }

  const responseData = isRecord(error.response)
    ? error.response.data
    : undefined;
  const responseError = isRecord(responseData) ? responseData.error : undefined;
  const code =
    typeof error.code === 'string'
      ? error.code
      : isRecord(responseError) && typeof responseError.code === 'string'
        ? responseError.code
        : '';
  if (/itemnotfound|erroritemnotfound/i.test(code)) {
    return true;
  }

  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('specified object was not found in the store');
}

export function normalizeAzureDateTime(
  value?: AzureGraphDateTime | null,
): Date | null {
  const rawDateTime = value?.dateTime?.trim();
  if (!rawDateTime) {
    return null;
  }

  const normalizedDateTime = /(?:z|[+-]\d{2}:\d{2})$/i.test(rawDateTime)
    ? rawDateTime
    : `${rawDateTime}Z`;
  const date = new Date(normalizedDateTime);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function truncateAzureText(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : value.slice(0, maxLength - 3) + '...';
}

export function normalizeAzureEmail(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^@\s<>]+@[^@\s<>]+$/.test(normalized)
    ? normalized
    : null;
}

function decodeAzureHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeAzureHttpUrl(
  value: string | null | undefined,
): string | null {
  const decoded = decodeAzureHtmlEntities(value?.trim() ?? '')
    .replace(/^[<([{'"\s]+/, '')
    .replace(/[>)\]}\s'",.;]+$/, '');
  if (!decoded) {
    return null;
  }

  try {
    const url = new URL(decoded);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (
      url.hostname.toLowerCase().endsWith('.safelinks.protection.outlook.com')
    ) {
      const originalUrl = url.searchParams.get('url');
      if (originalUrl) {
        return normalizeAzureHttpUrl(originalUrl);
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isKnownOnlineMeetingUrl(value: string): boolean {
  const hostname = new URL(value).hostname.toLowerCase();
  return (
    [
      'teams.microsoft.com',
      'teams.live.com',
      'teams.cloud.microsoft',
      'meet.google.com',
      'meet.jit.si',
      'join.skype.com',
    ].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ) ||
    ['zoom.us', 'webex.com', 'gotomeeting.com'].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  );
}

function extractAzureBodyUrls(body: string): {
  meetingLabelUrls: string[];
  urls: string[];
} {
  const meetingLabelUrls: string[] = [];
  const urls: string[] = [];
  const addUrl = (rawUrl: string, target: string[]) => {
    const normalized = normalizeAzureHttpUrl(rawUrl);
    if (normalized && !target.includes(normalized)) {
      target.push(normalized);
    }
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized);
    }
  };

  const anchorPattern =
    /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of body.matchAll(anchorPattern)) {
    const label = decodeAzureHtmlEntities(match[2].replace(/<[^>]+>/g, ' '));
    addUrl(
      match[1],
      /\b(join|meeting|teilnehmen|beitreten|besprechung)\b/i.test(label)
        ? meetingLabelUrls
        : urls,
    );
  }

  for (const match of body.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    addUrl(match[0], urls);
  }

  return { meetingLabelUrls, urls };
}

/**
 * Resolves the best join URL exposed by an Outlook calendar event. Graph's
 * structured onlineMeeting value is authoritative. Body/location fallbacks
 * cover forwarded and externally organized invitations where Graph sometimes
 * omits that value.
 */
export function resolveAzureOnlineMeetingUrl(
  event: AzureGraphCalendarEvent,
): string | null {
  for (const rawUrl of [
    event.onlineMeeting?.joinUrl,
    event.onlineMeetingUrl,
    ...(event.locations ?? []).map((location) => location.locationUri),
  ]) {
    const normalized = normalizeAzureHttpUrl(rawUrl);
    if (normalized) {
      return normalized;
    }
  }

  const body = event.body?.content?.trim();
  if (!body) {
    return null;
  }

  const { meetingLabelUrls, urls } = extractAzureBodyUrls(body);
  const knownMeetingUrl = urls.find(isKnownOnlineMeetingUrl);
  if (knownMeetingUrl) {
    return knownMeetingUrl;
  }
  if (meetingLabelUrls.length > 0) {
    return meetingLabelUrls[0];
  }
  if (event.isOnlineMeeting === true && urls.length === 1) {
    return urls[0];
  }

  return null;
}

export function buildAzureCalendarEvent(
  event: EventItem,
  classificationMappings?: CalendarClassificationMapping[] | null,
): Record<string, unknown> {
  const categories = resolveOutboundCalendarValues(
    event,
    classificationMappings,
  );
  const eventResource: Record<string, unknown> = {
    subject: event.title,
    start: { dateTime: event.startDate.toISOString(), timeZone: 'UTC' },
    end: { dateTime: event.endDate.toISOString(), timeZone: 'UTC' },
    recurrence: buildAzureRecurrence(event.startDate, event.recurrenceRule),
    attendees: event.participants.map((participant) => ({
      emailAddress: {
        address: participant.email,
        name: `${participant.firstName} ${participant.lastName}`,
      },
      type: 'required',
    })),
  };

  if (categories.length > 0) {
    eventResource.categories = categories;
  }

  eventResource.body = {
    contentType: 'HTML',
    content: event.description,
  };

  if (event.createOnlineMeeting) {
    eventResource.isOnlineMeeting = true;
    eventResource.onlineMeetingProvider = 'teamsForBusiness';
  }

  return eventResource;
}

export function buildAzureCalendarEventPatch(
  event: EventItem,
  classificationMappings?: CalendarClassificationMapping[] | null,
  changedFields?: string[],
): Record<string, unknown> {
  const eventResource = buildAzureCalendarEvent(event, classificationMappings);
  if (!changedFields) {
    return eventResource;
  }

  const changed = new Set(changedFields);
  const patch: Record<string, unknown> = {};
  const copy = (target: string) => {
    if (target in eventResource) {
      patch[target] = eventResource[target];
    }
  };

  if (changed.has('title')) copy('subject');
  if (changed.has('startDate')) {
    copy('start');
    copy('recurrence');
  }
  if (changed.has('endDate')) copy('end');
  if (changed.has('recurrenceRule')) copy('recurrence');
  if (changed.has('participants')) copy('attendees');
  if (changed.has('description')) copy('body');
  if (changed.has('createOnlineMeeting') && event.createOnlineMeeting) {
    copy('isOnlineMeeting');
    copy('onlineMeetingProvider');
  }
  if (changed.has('type') || changed.has('category')) copy('categories');

  return patch;
}
