import { type calendar_v3, google } from 'googleapis';
import type { EntityManager } from '@mikro-orm/core';
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
  type ImportGoogleCalendarEventsRange,
  isGoogleAuthenticationError,
  normalizeGoogleDateTime,
  normalizeGoogleEmail,
  normalizeGoogleRecurrence,
  resolveGoogleSeriesImportEvents,
  truncateGoogleText,
} from './google-calendar.utils';

export class GoogleCalendarOperations {
  protected async fetchCalendarEventsWithRetry(
    session: PersonSessionItem,
    accessToken: string,
    range: ImportGoogleCalendarEventsRange,
  ): Promise<calendar_v3.Schema$Event[]> {
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
  ): Promise<calendar_v3.Schema$Event[]> {
    const calendar = google.calendar({ version: 'v3' });
    const events: calendar_v3.Schema$Event[] = [];
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
        const status =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          typeof error.code === 'number'
            ? error.code
            : undefined;
        if (status === 404 || status === 410) {
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
    graphEvent: calendar_v3.Schema$Event,
    defaults: {
      user: PersonItem;
      type: EventTypeItem;
      category: EventCategoryItem;
      scheduledStatus: EventStatusItem;
      canceledStatus: EventStatusItem;
    },
  ): Promise<'created' | 'updated' | 'skipped'> {
    const referenceHandle = graphEvent.id?.trim();
    const startDate = normalizeGoogleDateTime(graphEvent.start);
    const endDate = normalizeGoogleDateTime(graphEvent.end);

    if (!referenceHandle || !startDate || !endDate) {
      return 'skipped';
    }

    const reference = await emFork.findOne(
      EventGoogleItem,
      { referenceHandle },
      { populate: ['event', 'event.participants', 'event.status'] },
    );

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
      const importedStatus =
        status.handle === 'scheduled' &&
        getRelationHandle(reference.event.status) === 'completed'
          ? (reference.event.status ?? status)
          : status;
      await this.assignImportedEvent(reference.event, graphEvent, {
        startDate,
        endDate,
        type: defaults.type,
        category: defaults.category,
        status: importedStatus,
        participants: participantPeople,
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
      type: defaults.type,
      category: defaults.category,
      status,
      participants: participantPeople,
    });

    const newReference = new EventGoogleItem();
    newReference.event = event;
    newReference.referenceHandle = referenceHandle;

    emFork.persist(event);
    emFork.persist(newReference);
    return 'created';
  }

  protected async assignImportedEvent(
    event: EventItem,
    graphEvent: calendar_v3.Schema$Event,
    values: {
      startDate: Date;
      endDate: Date;
      type: EventTypeItem;
      category: EventCategoryItem;
      status: EventStatusItem;
      participants: PersonItem[];
    },
  ): Promise<void> {
    const recurrence = normalizeGoogleRecurrence(graphEvent.recurrence);
    event.title = truncateGoogleText(
      graphEvent.summary?.trim() || 'Google event',
      128,
    );
    event.description = graphEvent.description?.trim() || undefined;
    event.startDate = values.startDate;
    event.endDate = values.endDate;
    event.recurrenceRule = recurrence.recurrenceRule;
    event.recurrenceExceptionDates = recurrence.exceptionDates;
    event.type = values.type;
    event.category = values.category;
    event.isAllDay = Boolean(
      graphEvent.start?.date && !graphEvent.start?.dateTime,
    );
    event.onlineMeetingURL =
      graphEvent.hangoutLink ??
      graphEvent.conferenceData?.entryPoints?.find(
        (entryPoint) => entryPoint.entryPointType === 'video',
      )?.uri ??
      event.onlineMeetingURL;
    event.status = values.status;
    await replaceCalendarEventParticipants(event, values.participants);
  }

  protected async resolveImportedParticipants(
    emFork: EntityManager,
    graphEvent: calendar_v3.Schema$Event,
    user: PersonItem,
  ): Promise<PersonItem[]> {
    const attendeeEmails = Array.from(
      new Set(
        (graphEvent.attendees ?? [])
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

    if (typeof user.handle === 'number') {
      participantsByHandle.set(user.handle, user);
    }

    for (const attendee of knownAttendees) {
      if (typeof attendee.handle === 'number') {
        participantsByHandle.set(attendee.handle, attendee);
      }
    }

    return Array.from(participantsByHandle.values());
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
    );

    // Create event in Google Calendar
    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventResource,
      auth: accessToken,
      sendUpdates: 'all',
    });

    // Create EventGoogleItem with Google event ID and save
    if (created?.data?.id) {
      const reference = new EventGoogleItem();
      reference.event = event;
      reference.referenceHandle = created.data.id;
      await emFork.persist(reference).flush();
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

    const { patch: eventResource, sendUpdates } = buildGoogleCalendarEventPatch(
      event,
      classificationMappings,
      changedFields,
    );

    if (Object.keys(eventResource).length === 0) {
      return { id: reference.referenceHandle, unchanged: true };
    }

    // reference.referenceHandle should contain the Google event id
    return await calendar.events.patch({
      calendarId: 'primary',
      eventId: reference.referenceHandle,
      requestBody: eventResource,
      auth: accessToken,
      sendUpdates,
    });
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
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: reference.referenceHandle,
      auth: accessToken,
      sendUpdates: 'all',
    });
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
