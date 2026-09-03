import type { jest } from '@jest/globals';
import { PersonItem } from '../../entity/PersonItem';
import { AzureCalendarService } from './azure.calendar.service';
import type { EventStatusItem } from '../../entity/EventStatusItem';

type UpsertResult = 'created' | 'updated' | 'skipped';

export type AzureCalendarServiceTestHarness = {
  upsertImportedEvent: (
    emFork: object,
    graphEvent: object,
    defaults: object,
  ) => Promise<UpsertResult>;
  resolveImportedParticipants: (
    emFork: object,
    graphEvent: object,
    user: PersonItem,
  ) => Promise<PersonItem[]>;
  reconcileMissingImportedEvents: (
    emFork: object,
    graphEvents: object[],
    range: { startDateTime: Date; endDateTime: Date },
    user: PersonItem,
    completedStatus: EventStatusItem,
    resolveMissingProviderItem: () => Promise<
      'missing' | 'updated' | 'unchanged'
    >,
  ) => Promise<number>;
};

export type AzureCategoryServiceTestHarness = {
  resolveAzureAccessToken: jest.MockedFunction<
    (...args: unknown[]) => Promise<string | null>
  >;
  fetchMasterCategoriesWithRetry: jest.MockedFunction<
    (
      ...args: unknown[]
    ) => Promise<Array<{ id?: string; displayName?: string; color?: string }>>
  >;
};

export type AzureDeliveryServiceTestHarness = {
  createEvent: (
    client: object,
    event: object,
    emFork: object,
    classificationMappings: [],
  ) => Promise<unknown>;
  updateEvent: (
    client: object,
    event: object,
    reference: object,
    emFork: object,
    classificationMappings: [],
    operation: 'remove-recurrence' | 'detach-occurrence',
  ) => Promise<unknown>;
  detachOccurrence: (
    client: object,
    reference: object,
    occurrenceStart: string,
  ) => Promise<unknown>;
  fetchAzureEventByReference: (
    accessToken: string,
    referenceHandle: string,
    futureStart: Date,
  ) => Promise<object | null>;
};

export type AzureSetEventTestHarness = {
  createEvent: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  deleteEvent: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  updateEvent: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
};

export const defaults = {
  user: { handle: 7, company: { handle: 42 } },
  type: { handle: 'online' },
  category: { handle: 'internal' },
  scheduledStatus: { handle: 'scheduled' },
  canceledStatus: { handle: 'canceled' },
};

export function createGraphEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outlook-1',
    iCalUId: 'ical-planning-1',
    subject: 'Planning',
    bodyPreview: 'Details',
    start: { dateTime: '2026-06-29T09:00:00.000Z' },
    end: { dateTime: '2026-06-29T10:00:00.000Z' },
    isAllDay: false,
    isCancelled: false,
    attendees: [],
    ...overrides,
  };
}

export function createService(): AzureCalendarServiceTestHarness {
  return new AzureCalendarService(
    {} as never,
    {} as never,
  ) as unknown as AzureCalendarServiceTestHarness;
}
