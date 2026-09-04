import { EventItem } from '../entity/EventItem';
import { getSaplingPropertyNamesWithOption } from '../entity/global/entity.decorator';

function appendAddressValues(
  source: object,
  values: string[],
  visited: Set<object>,
): void {
  if (visited.has(source)) {
    return;
  }
  visited.add(source);

  for (const propertyName of getSaplingPropertyNamesWithOption(
    source,
    'isAddress',
  )) {
    const value = (source as Record<string, unknown>)[propertyName];
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        values.push(normalized);
      }
      continue;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      values.push(String(value));
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      appendAddressValues(value, values, visited);
    }
  }
}

/** Builds the external calendar location from the customer company metadata. */
export function resolveCalendarEventLocation(event: EventItem): string | null {
  if (!event.creatorCompany) {
    return null;
  }

  const values: string[] = [];
  appendAddressValues(event.creatorCompany, values, new Set<object>());
  return values.length > 0 ? values.join(', ') : null;
}
