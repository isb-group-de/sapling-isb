import { EventItem } from '../../entity/EventItem';
import { buildAzureRecurrence } from '../calendar.recurrence';

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
  sensitivity?: string | null;
  start?: AzureGraphDateTime | null;
  end?: AzureGraphDateTime | null;
  isAllDay?: boolean | null;
  isCancelled?: boolean | null;
  attendees?: AzureGraphAttendee[] | null;
  onlineMeetingUrl?: string | null;
  onlineMeeting?: { joinUrl?: string | null } | null;
};

export type AzureCalendarViewResponse = {
  value?: AzureGraphCalendarEvent[];
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

export function buildAzureCalendarEvent(
  event: EventItem,
): Record<string, unknown> {
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
