import type { FilterQuery } from '@mikro-orm/core';
import { PersonItem } from '../entity/PersonItem';

export function normalizeCalendarParticipantEmail(
  value?: string | null,
): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function buildCalendarParticipantEmailFilter(
  emails: string[],
): FilterQuery<PersonItem> {
  const normalizedEmails = uniqueNormalizedEmails(emails);

  return {
    $or: normalizedEmails.map((email) => ({
      email: { $ilike: escapeIlikePattern(email) },
    })),
  };
}

export function selectUniqueCalendarParticipantsByEmail(
  people: PersonItem[],
  emails: string[],
): PersonItem[] {
  const normalizedEmails = uniqueNormalizedEmails(emails);
  const requestedEmails = new Set(normalizedEmails);
  const peopleByEmail = new Map<string, PersonItem[]>();

  for (const person of people) {
    const email = normalizeCalendarParticipantEmail(person.email);
    if (!email || !requestedEmails.has(email)) {
      continue;
    }

    const matches = peopleByEmail.get(email) ?? [];
    matches.push(person);
    peopleByEmail.set(email, matches);
  }

  return normalizedEmails.flatMap((email) => {
    const matches = peopleByEmail.get(email) ?? [];
    return matches.length === 1 ? matches : [];
  });
}

function uniqueNormalizedEmails(emails: string[]): string[] {
  return Array.from(
    new Set(
      emails
        .map(normalizeCalendarParticipantEmail)
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
