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

  if (event.type?.handle === 'online' && !event.onlineMeetingURL) {
    eventResource.isOnlineMeeting = true;
    eventResource.onlineMeetingProvider = 'teamsForBusiness';
  } else if (event.type?.handle !== 'online') {
    eventResource.body = {
      contentType: 'HTML',
      content: event.description,
    };
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
  if (changed.has('type') || changed.has('category')) copy('categories');

  return patch;
}
