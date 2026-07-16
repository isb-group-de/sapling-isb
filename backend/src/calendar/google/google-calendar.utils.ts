import { calendar_v3 } from '@googleapis/calendar';
import { EventItem } from '../../entity/EventItem';
import { buildGoogleRecurrence } from '../calendar.recurrence';

export type ImportGoogleCalendarEventsRange = {
  startDateTime: Date;
  endDateTime: Date;
};

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

export function buildGoogleCalendarEvent(
  event: EventItem,
): calendar_v3.Schema$Event {
  return {
    summary: event.title,
    description: event.description,
    start: { dateTime: event.startDate.toISOString() },
    end: { dateTime: event.endDate.toISOString() },
    recurrence: buildGoogleRecurrence(event.recurrenceRule),
    attendees: event.participants?.map((participant) => ({
      email: participant.email,
      displayName: `${participant.firstName} ${participant.lastName}`,
    })),
  };
}
