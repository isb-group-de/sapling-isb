import { EventItem } from '../entity/EventItem';
import { getSaplingPropertyNamesWithOption } from '../entity/global/entity.decorator';

export const CALENDAR_CONTACT_DETAILS_MARKER =
  'Kontaktinformationen aus Sapling';

export type CalendarContactDetails = {
  label: string;
  phoneNumbers: string[];
};

function readDecoratedTextValues(
  source: object,
  option: 'isValue' | 'isPhone',
): string[] {
  return getSaplingPropertyNamesWithOption(source, option).flatMap(
    (propertyName) => {
      const value = (source as Record<string, unknown>)[propertyName];
      if (typeof value !== 'string') {
        return [];
      }

      const normalized = value.trim();
      return normalized ? [normalized] : [];
    },
  );
}

/**
 * Resolves customer contact details solely from Sapling metadata. Event
 * relations marked as isCustomer are considered, and all isPhone values on
 * their related records are included in declaration order.
 */
export function resolveCalendarContactDetails(
  event: EventItem,
): CalendarContactDetails[] {
  const seenPhoneNumbers = new Set<string>();

  return getSaplingPropertyNamesWithOption(EventItem, 'isCustomer').flatMap(
    (propertyName) => {
      const value = (event as unknown as Record<string, unknown>)[propertyName];
      if (typeof value !== 'object' || value === null) {
        return [];
      }

      const phoneNumbers = readDecoratedTextValues(value, 'isPhone').filter(
        (phoneNumber) => {
          if (seenPhoneNumbers.has(phoneNumber)) {
            return false;
          }
          seenPhoneNumbers.add(phoneNumber);
          return true;
        },
      );
      if (phoneNumbers.length === 0) {
        return [];
      }

      const label = readDecoratedTextValues(value, 'isValue').join(' ');
      return [{ label, phoneNumbers }];
    },
  );
}

export function stripCalendarContactDetails(
  description: string | null | undefined,
): string | undefined {
  const normalized = description?.trim();
  if (!normalized) {
    return undefined;
  }

  const markerIndex = normalized.indexOf(CALENDAR_CONTACT_DETAILS_MARKER);
  if (markerIndex < 0) {
    return normalized;
  }

  const withoutContactDetails = normalized.slice(0, markerIndex).trimEnd();
  return (
    withoutContactDetails
      .replace(/(?:(?:<hr\s*\/?>|<p>|<strong>)\s*)+$/i, '')
      .replace(/[-–—]{3,}\s*$/i, '')
      .trim() || undefined
  );
}

export function buildCalendarTextDescription(
  event: EventItem,
): string | undefined {
  const description = stripCalendarContactDetails(event.description);
  const contacts = resolveCalendarContactDetails(event);
  if (contacts.length === 0) {
    return description;
  }

  const contactLines = contacts.map(({ label, phoneNumbers }) =>
    [label, phoneNumbers.join(' / ')].filter(Boolean).join(': '),
  );
  const contactBlock = [CALENDAR_CONTACT_DETAILS_MARKER, ...contactLines].join(
    '\n',
  );
  return [description, contactBlock].filter(Boolean).join('\n\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCalendarHtmlDescription(
  event: EventItem,
): string | undefined {
  const description = stripCalendarContactDetails(event.description);
  const contacts = resolveCalendarContactDetails(event);
  if (contacts.length === 0) {
    return description;
  }

  const contactLines = contacts.map(({ label, phoneNumbers }) => {
    const phoneLinks = phoneNumbers
      .map(
        (phoneNumber) =>
          `<a href="tel:${escapeHtml(phoneNumber)}">${escapeHtml(phoneNumber)}</a>`,
      )
      .join(' / ');
    return [
      label ? `<strong>${escapeHtml(label)}</strong>: ` : '',
      phoneLinks,
    ].join('');
  });
  const contactBlock = `<p><strong>${CALENDAR_CONTACT_DETAILS_MARKER}</strong><br>${contactLines.join('<br>')}</p>`;

  return [description, contactBlock].filter(Boolean).join('<hr>');
}
