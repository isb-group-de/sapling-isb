import type { EventItem } from '../entity/EventItem';
import type {
  OutlookAvailabilityMapping,
  OutlookShowAs,
} from '../entity/CalendarSyncSubscriptionItem';

export const OUTLOOK_SHOW_AS_VALUES = [
  'free',
  'tentative',
  'busy',
  'oof',
  'workingElsewhere',
] as const satisfies readonly OutlookShowAs[];

function normalizeHandle(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function isOutlookShowAs(value: unknown): value is OutlookShowAs {
  return OUTLOOK_SHOW_AS_VALUES.includes(value as OutlookShowAs);
}

export function normalizeOutlookAvailabilityMappings(
  mappings?: OutlookAvailabilityMapping[] | null,
): OutlookAvailabilityMapping[] {
  return (mappings ?? [])
    .map((mapping) => ({
      eventStatusHandle: normalizeHandle(mapping.eventStatusHandle),
      eventTypeHandle: normalizeHandle(mapping.eventTypeHandle),
      eventCategoryHandle: normalizeHandle(mapping.eventCategoryHandle),
      showAs: mapping.showAs,
    }))
    .filter(
      (mapping) =>
        isOutlookShowAs(mapping.showAs) &&
        Boolean(
          mapping.eventStatusHandle ||
          mapping.eventTypeHandle ||
          mapping.eventCategoryHandle,
        ),
    );
}

export function resolveOutlookShowAs(
  event: Pick<EventItem, 'isOutlookAvailable' | 'status' | 'type' | 'category'>,
  mappings?: OutlookAvailabilityMapping[] | null,
): OutlookShowAs {
  if (event.isOutlookAvailable) {
    return 'free';
  }

  const statusHandle = event.status?.handle;
  const typeHandle = event.type?.handle;
  const categoryHandle = event.category?.handle;
  const match = normalizeOutlookAvailabilityMappings(mappings)
    .map((mapping, index) => {
      const statusMatches =
        !mapping.eventStatusHandle ||
        mapping.eventStatusHandle === statusHandle;
      const typeMatches =
        !mapping.eventTypeHandle || mapping.eventTypeHandle === typeHandle;
      const categoryMatches =
        !mapping.eventCategoryHandle ||
        mapping.eventCategoryHandle === categoryHandle;

      if (!statusMatches || !typeMatches || !categoryMatches) {
        return null;
      }

      return {
        index,
        mapping,
        specificity:
          Number(Boolean(mapping.eventStatusHandle)) +
          Number(Boolean(mapping.eventTypeHandle)) +
          Number(Boolean(mapping.eventCategoryHandle)),
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        index: number;
        mapping: OutlookAvailabilityMapping;
        specificity: number;
      } => candidate != null,
    )
    .sort(
      (left, right) =>
        right.specificity - left.specificity || left.index - right.index,
    )[0];

  return match?.mapping.showAs ?? 'busy';
}
