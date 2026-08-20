import { calendar_v3 } from '@googleapis/calendar';
import { EventItem } from '../../entity/EventItem';
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
  classificationMappings?: CalendarClassificationMapping[] | null,
): calendar_v3.Schema$Event {
  const colorId = resolveGoogleCalendarColorId(event, classificationMappings);

  return {
    summary: event.title,
    description: event.description,
    start: { dateTime: event.startDate.toISOString() },
    end: { dateTime: event.endDate.toISOString() },
    recurrence: buildGoogleRecurrence(event.recurrenceRule),
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
  };
}

export function buildGoogleCalendarEventPatch(
  event: EventItem,
  classificationMappings?: CalendarClassificationMapping[] | null,
  changedFields?: string[],
): {
  patch: calendar_v3.Schema$Event;
  sendUpdates: 'all' | 'none';
} {
  const eventResource = buildGoogleCalendarEvent(event, classificationMappings);
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
  if (changed.has('recurrenceRule')) copy('recurrence');
  if (changed.has('participants')) copy('attendees');
  if (changed.has('type') || changed.has('category')) {
    copy('colorId');
    copy('extendedProperties');
  }

  const attendeeVisibleFields = [
    'summary',
    'description',
    'start',
    'end',
    'recurrence',
    'attendees',
  ];
  const sendUpdates = attendeeVisibleFields.some((field) => field in patch)
    ? 'all'
    : 'none';

  return { patch, sendUpdates };
}
