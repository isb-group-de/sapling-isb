import type { FilterQuery } from '@mikro-orm/core';
import type { EventItem } from '../entity/EventItem';
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

/**
 * Reconciles imported participants through the owning side of EventItem's
 * many-to-many relation. Updating EventItem.participants alone changes only
 * the inverse collection and is not persisted for an existing event.
 */
export async function replaceCalendarEventParticipants(
  event: EventItem,
  participants: PersonItem[],
): Promise<void> {
  const collection = event.participants as typeof event.participants & {
    add?: (...items: PersonItem[]) => void;
    getItems?: () => PersonItem[];
    init?: () => Promise<unknown>;
    isInitialized?: () => boolean;
    removeAll?: () => void;
    set?: (items: PersonItem[]) => void;
    setDirty?: (dirty?: boolean) => void;
    splice?: (start: number, deleteCount?: number) => unknown;
  };

  // Unit-test and detached-entity doubles do not expose MikroORM's complete
  // Collection API. Keep the assignment behavior usable for those objects.
  if (
    typeof collection.isInitialized !== 'function' ||
    typeof collection.init !== 'function' ||
    typeof collection.getItems !== 'function' ||
    typeof collection.set !== 'function'
  ) {
    if (typeof collection.removeAll === 'function') {
      collection.removeAll();
    } else {
      collection.splice?.(0, collection.length);
    }
    collection.add?.(...participants);
    return;
  }

  if (!collection.isInitialized()) {
    await collection.init();
  }

  const desiredByHandle = new Map(
    participants.flatMap((participant) =>
      typeof participant.handle === 'number'
        ? ([[participant.handle, participant]] as const)
        : [],
    ),
  );

  // New events can still persist their initial inverse collection while the
  // event itself is inserted. Existing events need changes on Person.events,
  // which owns the pivot table.
  if (typeof event.handle !== 'number') {
    collection.set([...desiredByHandle.values()]);
    return;
  }

  const currentByHandle = new Map(
    collection
      .getItems()
      .flatMap((participant) =>
        typeof participant.handle === 'number'
          ? ([[participant.handle, participant]] as const)
          : [],
      ),
  );
  const removed = [...currentByHandle.entries()]
    .filter(([handle]) => !desiredByHandle.has(handle))
    .map(([, participant]) => participant);
  const added = [...desiredByHandle.entries()]
    .filter(([handle]) => !currentByHandle.has(handle))
    .map(([, participant]) => participant);

  await Promise.all(
    [...removed, ...added].map((participant) =>
      participant.events.init({ where: { handle: event.handle } }),
    ),
  );

  for (const participant of removed) {
    participant.events.remove(event);
  }
  for (const participant of added) {
    participant.events.add(event);
  }

  // Owning-side mutations propagate to the inverse collection. Setting it as
  // well keeps lightweight test doubles and detached entities consistent. Do
  // not enqueue that inverse collection too: syncing both sides of the same
  // pivot in one flush can overwrite the owning-side update.
  collection.set([...desiredByHandle.values()]);
  collection.setDirty?.(false);
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
