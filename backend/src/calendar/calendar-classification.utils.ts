import type { EventItem } from '../entity/EventItem';
import type { CalendarClassificationMapping } from '../entity/CalendarSyncSubscriptionItem';

export type { CalendarClassificationMapping } from '../entity/CalendarSyncSubscriptionItem';

export const DEFAULT_CALENDAR_EVENT_TYPE_HANDLE = 'online';
export const DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE = 'internal';

export type CalendarClassification = {
  eventTypeHandle: string;
  eventCategoryHandle: string;
};

export type CalendarClassificationDefaults = {
  eventTypeHandle?: string | null;
  eventCategoryHandle?: string | null;
};

function normalizeValue(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function normalizeCalendarClassificationMappings(
  mappings?: CalendarClassificationMapping[] | null,
): CalendarClassificationMapping[] {
  return (mappings ?? [])
    .map((mapping) => ({
      externalValue: normalizeValue(mapping.externalValue) ?? '',
      eventTypeHandle: normalizeValue(mapping.eventTypeHandle),
      eventCategoryHandle: normalizeValue(mapping.eventCategoryHandle),
    }))
    .filter(
      (mapping) =>
        Boolean(mapping.externalValue) &&
        Boolean(mapping.eventTypeHandle || mapping.eventCategoryHandle),
    );
}

export function resolveImportedCalendarClassification(options: {
  mappings?: CalendarClassificationMapping[] | null;
  externalValues?: Array<string | null | undefined> | null;
  embeddedEventTypeHandle?: string | null;
  embeddedEventCategoryHandle?: string | null;
  defaults?: CalendarClassificationDefaults | null;
}): CalendarClassification {
  let eventTypeHandle = normalizeValue(options.embeddedEventTypeHandle);
  let eventCategoryHandle = normalizeValue(options.embeddedEventCategoryHandle);
  const externalValues = new Set(
    (options.externalValues ?? [])
      .map((value) => normalizeValue(value))
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );

  for (const mapping of normalizeCalendarClassificationMappings(
    options.mappings,
  )) {
    if (!externalValues.has(mapping.externalValue.toLowerCase())) {
      continue;
    }

    eventTypeHandle ??= normalizeValue(mapping.eventTypeHandle);
    eventCategoryHandle ??= normalizeValue(mapping.eventCategoryHandle);
  }

  return {
    eventTypeHandle:
      eventTypeHandle ??
      normalizeValue(options.defaults?.eventTypeHandle) ??
      DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
    eventCategoryHandle:
      eventCategoryHandle ??
      normalizeValue(options.defaults?.eventCategoryHandle) ??
      DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
  };
}

export function resolveOutboundCalendarValues(
  event: Pick<EventItem, 'type' | 'category'>,
  mappings?: CalendarClassificationMapping[] | null,
): string[] {
  const typeHandle = event.type?.handle;
  const categoryHandle = event.category?.handle;

  return Array.from(
    new Set(
      normalizeCalendarClassificationMappings(mappings)
        .filter((mapping) => {
          const hasType = Boolean(mapping.eventTypeHandle);
          const hasCategory = Boolean(mapping.eventCategoryHandle);
          const typeMatches =
            !hasType || mapping.eventTypeHandle === typeHandle;
          const categoryMatches =
            !hasCategory || mapping.eventCategoryHandle === categoryHandle;
          return typeMatches && categoryMatches;
        })
        .map((mapping) => mapping.externalValue),
    ),
  );
}

export function resolveGoogleCalendarColorId(
  event: Pick<EventItem, 'type' | 'category'>,
  mappings?: CalendarClassificationMapping[] | null,
): string | undefined {
  const typeHandle = event.type?.handle;
  const categoryHandle = event.category?.handle;

  const match = normalizeCalendarClassificationMappings(mappings)
    .map((mapping) => {
      const typeMatches =
        !mapping.eventTypeHandle || mapping.eventTypeHandle === typeHandle;
      const categoryMatches =
        !mapping.eventCategoryHandle ||
        mapping.eventCategoryHandle === categoryHandle;

      if (!typeMatches || !categoryMatches) {
        return null;
      }

      return {
        mapping,
        score:
          Number(Boolean(mapping.eventTypeHandle)) +
          Number(Boolean(mapping.eventCategoryHandle)),
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        mapping: CalendarClassificationMapping;
        score: number;
      } => candidate != null,
    )
    .sort((left, right) => right.score - left.score)[0];

  return match?.mapping.externalValue;
}
