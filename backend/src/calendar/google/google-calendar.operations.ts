import { type calendar_v3, google } from 'googleapis';
import type { EntityManager } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import {
  findRecurrenceOccurrence,
  hasRecurrenceOccurrenceInRange,
} from '../calendar.recurrence';
import {
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../../constants/project.constants';
import { CalendarSyncSubscriptionItem } from '../../entity/CalendarSyncSubscriptionItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import { EventGoogleItem } from '../../entity/EventGoogleItem';
import { EventItem } from '../../entity/EventItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { type CalendarClassificationMapping } from '../calendar-classification.utils';
import {
  buildCalendarParticipantEmailFilter,
  replaceCalendarEventParticipants,
  selectUniqueCalendarParticipantsByEmail,
} from '../calendar-participant.utils';
import {
  buildGoogleCalendarEvent,
  buildGoogleCalendarEventPatch,
  type GoogleCalendarImportEvent,
  type ImportGoogleCalendarEventsRange,
  isGoogleAuthenticationError,
  isGoogleNotFoundError,
  normalizeGoogleDateTime,
  normalizeGoogleEmail,
  normalizeGoogleRecurrence,
  resolveGoogleSeriesImportEvents,
  truncateGoogleText,
} from './google-calendar.utils';

type MissingProviderItemResolution = 'missing' | 'updated' | 'unchanged';

export class GoogleCalendarOperations {
  protected async fetchCalendarEventsWithRetry(
    session: PersonSessionItem,
    accessToken: string,
    range: ImportGoogleCalendarEventsRange,
  ): Promise<GoogleCalendarImportEvent[]> {
    try {
      return await this.fetchCalendarEvents(accessToken, range);
    } catch (error) {
      if (!isGoogleAuthenticationError(error)) {
        throw error;
      }

      const refreshedToken = await this.refreshGoogleAccessToken(session);
      if (!refreshedToken) {
        throw error;
      }

      return this.fetchCalendarEvents(refreshedToken, range);
    }
  }

  protected async fetchCalendarEvents(
    accessToken: string,
    range: ImportGoogleCalendarEventsRange,
  ): Promise<GoogleCalendarImportEvent[]> {
    const calendar = google.calendar({ version: 'v3' });
    const events: GoogleCalendarImportEvent[] = [];
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId: 'primary',
        auth: accessToken,
        timeMin: range.startDateTime.toISOString(),
        timeMax: range.endDateTime.toISOString(),
        singleEvents: true,
        showDeleted: true,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken,
      });

      events.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return resolveGoogleSeriesImportEvents(events, async (recurringEventId) => {
      try {
        const response = await calendar.events.get({
          calendarId: 'primary',
          eventId: recurringEventId,
          auth: accessToken,
        });
        return response.data;
      } catch (error) {
        if (isGoogleNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  }

  protected async refreshGoogleAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const refreshToken = session.refreshToken?.trim();
    if (!refreshToken) {
      return null;
    }

    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID || undefined,
      GOOGLE_CLIENT_SECRET || undefined,
      GOOGLE_CALLBACK_URL || undefined,
    );

    auth.setCredentials({ refresh_token: refreshToken });
    const refreshed = await auth.refreshAccessToken();
    const accessToken = refreshed.credentials.access_token?.trim() ?? null;

    if (accessToken) {
      session.accessToken = accessToken;
    }

    return accessToken;
  }

  protected async resolveGoogleAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const directToken = session.accessToken?.trim();
    if (directToken) {
      return directToken;
    }

    return this.refreshGoogleAccessToken(session);
  }

  protected getPersonTypeHandle(person: PersonItem): string | undefined {
    return person.type?.handle;
  }

  protected async loadClassificationMappings(
    emFork: EntityManager,
    personHandle?: number,
  ): Promise<CalendarClassificationMapping[]> {
    if (personHandle == null) {
      return [];
    }

    const subscription = await emFork.findOne(CalendarSyncSubscriptionItem, {
      person: { handle: personHandle },
      provider: 'google',
    });
    return subscription?.classificationMappings ?? [];
  }

  protected async upsertImportedEvent(
    emFork: EntityManager,
    graphEvent: GoogleCalendarImportEvent,
    defaults: {
      user: PersonItem;
      type: EventTypeItem;
      category: EventCategoryItem;
      scheduledStatus: EventStatusItem;
      canceledStatus: EventStatusItem;
    },
  ): Promise<'created' | 'updated' | 'skipped'> {
    const referenceHandle = graphEvent.id?.trim();
    const iCalUId = graphEvent.iCalUID?.trim() || null;
    const providerStartDate = normalizeGoogleDateTime(graphEvent.start);
    const providerEndDate = normalizeGoogleDateTime(graphEvent.end);
    const occurrenceStartDate = normalizeGoogleDateTime(
      graphEvent.saplingImportOccurrence?.start,
    );
    const occurrenceEndDate = normalizeGoogleDateTime(
      graphEvent.saplingImportOccurrence?.end,
    );
    const startDate = occurrenceStartDate ?? providerStartDate;
    const endDate = occurrenceEndDate ?? providerEndDate;
    const normalizedRecurrence = normalizeGoogleRecurrence(
      graphEvent.recurrence,
    );
    const recurrenceRule = rebaseImportedRecurrenceRule(
      normalizedRecurrence.recurrenceRule,
      providerStartDate,
      occurrenceStartDate,
    );

    if (!referenceHandle || !startDate || !endDate) {
      return 'skipped';
    }

    const populateOptions = {
      populate: ['event', 'event.participants', 'event.status'],
    } as const;
    const reference =
      (iCalUId
        ? await emFork.findOne(
            EventGoogleItem,
            { iCalUId },
            populateOptions as never,
          )
        : null) ??
      (await emFork.findOne(
        EventGoogleItem,
        { referenceHandle },
        populateOptions as never,
      ));

    if (graphEvent.status === 'cancelled' && !reference) {
      return 'skipped';
    }

    const status =
      graphEvent.status === 'cancelled'
        ? defaults.canceledStatus
        : defaults.scheduledStatus;
    const participantPeople = await this.resolveImportedParticipants(
      emFork,
      graphEvent,
      defaults.user,
    );

    if (reference?.event && typeof reference.event === 'object') {
      if (iCalUId && !reference.iCalUId) {
        reference.iCalUId = iCalUId;
      }
      const importedStatus =
        status.handle === 'scheduled' &&
        getRelationHandle(reference.event.status) === 'completed'
          ? (reference.event.status ?? status)
          : status;
      await this.assignImportedEvent(reference.event, graphEvent, {
        startDate,
        endDate,
        status: importedStatus,
        participants: participantPeople,
        recurrenceRule,
        exceptionDates: normalizedRecurrence.exceptionDates,
      });
      return 'updated';
    }

    const event = new EventItem();
    event.creatorCompany = defaults.user.company;
    event.creatorPerson = defaults.user;
    event.assigneeCompany = defaults.user.company;
    event.assigneePerson = defaults.user;
    await this.assignImportedEvent(event, graphEvent, {
      startDate,
      endDate,
      status,
      participants: participantPeople,
      recurrenceRule,
      exceptionDates: normalizedRecurrence.exceptionDates,
      classification: { type: defaults.type, category: defaults.category },
    });

    const newReference = new EventGoogleItem();
    newReference.event = event;
    newReference.referenceHandle = referenceHandle;
    newReference.iCalUId = iCalUId;

    emFork.persist(event);
    emFork.persist(newReference);
    return 'created';
  }

  protected async assignImportedEvent(
    event: EventItem,
    graphEvent: GoogleCalendarImportEvent,
    values: {
      startDate: Date;
      endDate: Date;
      status: EventStatusItem;
      participants: PersonItem[];
      recurrenceRule: string | null;
      exceptionDates: string[];
      classification?: {
        type: EventTypeItem;
        category: EventCategoryItem;
      };
    },
  ): Promise<void> {
    event.title = truncateGoogleText(
      graphEvent.summary?.trim() || 'Google event',
      128,
    );
    event.description = graphEvent.description?.trim() || undefined;
    event.startDate = values.startDate;
    event.endDate = values.endDate;
    event.recurrenceRule = values.recurrenceRule;
    event.recurrenceExceptionDates = values.exceptionDates;
    if (values.classification) {
      event.type = values.classification.type;
      event.category = values.classification.category;
    }
    event.isAllDay = Boolean(
      graphEvent.start?.date && !graphEvent.start?.dateTime,
    );
    const onlineMeetingURL =
      graphEvent.hangoutLink ??
      graphEvent.conferenceData?.entryPoints?.find(
        (entryPoint) => entryPoint.entryPointType === 'video',
      )?.uri;
    event.onlineMeetingURL = onlineMeetingURL ?? event.onlineMeetingURL;
    event.createOnlineMeeting = Boolean(
      onlineMeetingURL ||
      graphEvent.conferenceData?.conferenceSolution ||
      graphEvent.conferenceData?.createRequest,
    );
    event.status = values.status;
    await replaceCalendarEventParticipants(event, values.participants);
  }

  protected async resolveImportedParticipants(
    emFork: EntityManager,
    graphEvent: GoogleCalendarImportEvent,
    user: PersonItem,
  ): Promise<PersonItem[]> {
    const attendeeEmails = Array.from(
      new Set(
        (graphEvent.attendees ?? [])
          .filter((attendee) => attendee.organizer !== true)
          .map((attendee) => normalizeGoogleEmail(attendee.email))
          .filter((email): email is string => Boolean(email)),
      ),
    );

    const attendeeCandidates =
      attendeeEmails.length > 0
        ? await emFork.find(
            PersonItem,
            buildCalendarParticipantEmailFilter(attendeeEmails),
          )
        : [];
    const knownAttendees = selectUniqueCalendarParticipantsByEmail(
      attendeeCandidates,
      attendeeEmails,
    );
    const participantsByHandle = new Map<number, PersonItem>();

    if (attendeeEmails.length === 0 && typeof user.handle === 'number') {
      participantsByHandle.set(user.handle, user);
    }

    for (const attendee of knownAttendees) {
      if (typeof attendee.handle === 'number') {
        participantsByHandle.set(attendee.handle, attendee);
      }
    }

    return Array.from(participantsByHandle.values());
  }

  protected async reconcileMissingImportedEvents(
    emFork: EntityManager,
    graphEvents: GoogleCalendarImportEvent[],
    range: ImportGoogleCalendarEventsRange,
    user: PersonItem,
    completedStatus: EventStatusItem,
    resolveMissingProviderItem: (
      reference: EventGoogleItem,
    ) => Promise<MissingProviderItemResolution>,
  ): Promise<number> {
    if (typeof user.handle !== 'number') {
      return 0;
    }

    const references = await emFork.find(
      EventGoogleItem,
      {
        event: {
          status: { handle: 'scheduled' },
          $or: [
            { participants: { handle: user.handle } },
            { creatorPerson: { handle: user.handle } },
          ],
        },
      },
      { populate: ['event', 'event.participants', 'event.status'] } as never,
    );
    const returnedReferenceHandles = new Set(
      graphEvents
        .filter((event) => event.status !== 'cancelled')
        .map((event) => event.id?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    const returnedICalUIds = new Set(
      graphEvents
        .filter((event) => event.status !== 'cancelled')
        .map((event) => event.iCalUID?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    let reconciled = 0;

    for (const reference of references) {
      const event = reference.event;
      if (!event || typeof event !== 'object') {
        continue;
      }
      const expectedInRange = event.recurrenceRule
        ? hasRecurrenceOccurrenceInRange(
            event.startDate,
            event.endDate,
            event.recurrenceRule,
            range.startDateTime,
            range.endDateTime,
          )
        : event.startDate < range.endDateTime &&
          event.endDate > range.startDateTime;
      if (
        !expectedInRange ||
        (reference.iCalUId
          ? returnedICalUIds.has(reference.iCalUId)
          : returnedReferenceHandles.has(reference.referenceHandle))
      ) {
        continue;
      }

      const resolution = await resolveMissingProviderItem(reference);
      if (resolution === 'updated') {
        reconciled += 1;
        continue;
      }
      if (resolution === 'unchanged') {
        continue;
      }

      const participants = await getInitializedParticipants(event);
      const remainingParticipants = participants.filter(
        (participant) => participant.handle !== user.handle,
      );
      await replaceCalendarEventParticipants(event, remainingParticipants);
      if (remainingParticipants.length === 0) {
        event.status = completedStatus;
      }
      reconciled += 1;
    }

    return reconciled;
  }

  protected async fetchGoogleEventByReference(
    accessToken: string,
    referenceHandle: string,
    futureStart: Date,
  ): Promise<GoogleCalendarImportEvent | null> {
    const calendar = google.calendar({ version: 'v3' });
    let graphEvent: GoogleCalendarImportEvent;
    try {
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: referenceHandle,
        auth: accessToken,
      });
      graphEvent = response.data;
    } catch (error) {
      if (isGoogleNotFoundError(error)) {
        return null;
      }
      throw error;
    }

    if (graphEvent.status === 'cancelled') {
      return null;
    }
    if (!graphEvent.recurrence?.length) {
      return graphEvent;
    }

    const futureEnd = new Date(futureStart);
    futureEnd.setUTCFullYear(futureEnd.getUTCFullYear() + 5);
    const instances = await calendar.events.instances({
      calendarId: 'primary',
      eventId: referenceHandle,
      auth: accessToken,
      timeMin: futureStart.toISOString(),
      timeMax: futureEnd.toISOString(),
      maxResults: 1,
      showDeleted: false,
    });
    const nextOccurrence = (instances.data.items ?? [])
      .filter((event) => normalizeGoogleDateTime(event.start))
      .sort(
        (left, right) =>
          normalizeGoogleDateTime(left.start)!.getTime() -
          normalizeGoogleDateTime(right.start)!.getTime(),
      )[0];

    return nextOccurrence
      ? {
          ...graphEvent,
          saplingImportOccurrence: {
            start: nextOccurrence.start,
            end: nextOccurrence.end,
          },
        }
      : graphEvent;
  }

  /**
   * Creates a new event in the Google calendar using Google Calendar API.
   * @param {calendar_v3.Calendar} calendar Authenticated Google Calendar client
   * @param {EventItem} event The event to create
   * @param {PersonSessionItem} session The user session containing access tokens
   * @param {EntityManager} emFork Forked EntityManager for database operations
   * @returns {Promise<any>} The created event object from Google Calendar API
   */
  protected async createEvent(
    calendar: calendar_v3.Calendar,
    event: EventItem,
    accessToken: string,
    emFork: EntityManager,
    classificationMappings?: CalendarClassificationMapping[] | null,
  ): Promise<any> {
    const eventResource = buildGoogleCalendarEvent(
      event,
      classificationMappings,
      event.createOnlineMeeting
        ? buildGoogleConferenceRequestId(event)
        : undefined,
    );

    // Create event in Google Calendar
    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventResource,
      auth: accessToken,
      sendUpdates: 'all',
      conferenceDataVersion: 1,
    });

    // Create EventGoogleItem with Google event ID and save
    if (created?.data?.id) {
      const reference = new EventGoogleItem();
      reference.event = event;
      reference.referenceHandle = created.data.id;
      reference.iCalUId = created.data.iCalUID?.trim() || null;
      await emFork.persist(reference).flush();
    }

    const onlineMeetingURL = resolveGoogleOnlineMeetingUrl(created?.data);
    if (event.createOnlineMeeting && onlineMeetingURL) {
      event.onlineMeetingURL = onlineMeetingURL;
      await emFork.persist(event).flush();
    }

    return created;
  }

  /**
   * Updates an existing event in the Google calendar using Google Calendar API.
   * @param {calendar_v3.Calendar} calendar Authenticated Google Calendar client
   * @param {EventItem} event The updated event data
   * @param {EventGoogleItem} reference The EventGoogleItem containing the Google event ID
   * @param {PersonSessionItem} session The user session containing access tokens
   * @returns {Promise<any>} The updated event object from Google Calendar API
   */
  protected async updateEvent(
    calendar: calendar_v3.Calendar,
    event: EventItem,
    reference: EventGoogleItem,
    accessToken: string,
    emFork: EntityManager,
    classificationMappings?: CalendarClassificationMapping[] | null,
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
  ): Promise<any> {
    if (operation === 'remove-recurrence') {
      const resource = buildGoogleCalendarEvent(event, classificationMappings);
      return await calendar.events.patch({
        calendarId: 'primary',
        eventId: reference.referenceHandle,
        requestBody: {
          start: resource.start,
          end: resource.end,
          recurrence: [],
        },
        auth: accessToken,
      });
    }

    if (operation === 'detach-occurrence') {
      return await calendar.events.patch({
        calendarId: 'primary',
        eventId: reference.referenceHandle,
        requestBody: {
          recurrence: buildGoogleCalendarEvent(event, classificationMappings)
            .recurrence,
        },
        auth: accessToken,
        sendUpdates: 'all',
      });
    }

    const requestConference =
      Boolean(event.createOnlineMeeting) &&
      !event.onlineMeetingURL &&
      (!changedFields || changedFields.includes('createOnlineMeeting'));
    const { patch: eventResource, sendUpdates } = buildGoogleCalendarEventPatch(
      event,
      classificationMappings,
      changedFields,
      requestConference ? buildGoogleConferenceRequestId(event) : undefined,
    );

    if (Object.keys(eventResource).length === 0) {
      return { id: reference.referenceHandle, unchanged: true };
    }

    // reference.referenceHandle should contain the Google event id
    const updated = await calendar.events.patch({
      calendarId: 'primary',
      eventId: reference.referenceHandle,
      requestBody: eventResource,
      auth: accessToken,
      sendUpdates,
      conferenceDataVersion: 1,
    });
    const onlineMeetingURL = resolveGoogleOnlineMeetingUrl(updated?.data);
    if (event.createOnlineMeeting && onlineMeetingURL) {
      event.onlineMeetingURL = onlineMeetingURL;
      await emFork.persist(event).flush();
    }
    return updated;
  }

  /**
   * Deletes an event from the Google calendar and removes its reference from the database.
   * @param {calendar_v3.Calendar} calendar Authenticated Google Calendar client
   * @param {EventGoogleItem} reference The EventGoogleItem containing the Google event ID
   * @param {PersonSessionItem} session The user session containing access tokens
   * @param {EntityManager} emFork Forked EntityManager for database operations
   * @returns {Promise<any>} An object indicating success
   */
  protected async deleteEvent(
    calendar: calendar_v3.Calendar,
    reference: EventGoogleItem,
    accessToken: string,
    emFork: EntityManager,
  ): Promise<any> {
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: reference.referenceHandle,
        auth: accessToken,
        sendUpdates: 'all',
      });
    } catch (error) {
      if (!isGoogleNotFoundError(error)) {
        throw error;
      }
    }
    // Remove the EventGoogleItem from the database
    await emFork.remove(reference).flush();
    return { success: true };
  }
}

export function getRelationHandle(
  value?: string | { handle?: string } | null,
): string {
  return typeof value === 'string' ? value : (value?.handle ?? '');
}

async function getInitializedParticipants(
  event: EventItem,
): Promise<PersonItem[]> {
  const collection = event.participants as typeof event.participants & {
    getItems?: () => PersonItem[];
    init?: () => Promise<unknown>;
    isInitialized?: () => boolean;
  };
  if (
    typeof collection.isInitialized === 'function' &&
    typeof collection.init === 'function' &&
    !collection.isInitialized()
  ) {
    await collection.init();
  }
  if (typeof collection.getItems === 'function') {
    return collection.getItems();
  }
  return Array.from(collection as Iterable<PersonItem>);
}

function rebaseImportedRecurrenceRule(
  recurrenceRule: string | null,
  providerStartDate: Date | null,
  occurrenceStartDate: Date | null,
): string | null {
  if (!recurrenceRule || !providerStartDate || !occurrenceStartDate) {
    return recurrenceRule;
  }
  const countMatch = /(?:^|;)COUNT=(\d+)(?:;|$)/.exec(recurrenceRule);
  if (!countMatch) {
    return recurrenceRule;
  }
  const occurrence = findRecurrenceOccurrence(
    providerStartDate,
    providerStartDate,
    recurrenceRule,
    occurrenceStartDate,
  );
  if (!occurrence) {
    return recurrenceRule;
  }
  const originalCount = Number.parseInt(countMatch[1], 10);
  const remainingCount = Math.max(
    1,
    originalCount - occurrence.occurrenceIndex + 1,
  );
  return recurrenceRule.replace(
    /(^|;)COUNT=\d+(?=;|$)/,
    `$1COUNT=${remainingCount}`,
  );
}

function resolveGoogleOnlineMeetingUrl(
  event?: calendar_v3.Schema$Event | null,
): string | null {
  return (
    event?.hangoutLink?.trim() ||
    event?.conferenceData?.entryPoints
      ?.find((entryPoint) => entryPoint.entryPointType === 'video')
      ?.uri?.trim() ||
    null
  );
}

function buildGoogleConferenceRequestId(event: EventItem): string {
  return `sapling-event-${event.handle ?? randomUUID()}`;
}
