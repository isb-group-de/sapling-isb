import { Client } from '@microsoft/microsoft-graph-client';
import type { EntityManager } from '@mikro-orm/core';
import axios from 'axios';
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AZURE_AD_SCOPE,
  AZURE_AD_TENNANT_ID,
} from '../../constants/project.constants';
import { CalendarSyncSubscriptionItem } from '../../entity/CalendarSyncSubscriptionItem';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import { EventItem } from '../../entity/EventItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import type { CalendarClassificationMapping } from '../calendar-classification.utils';
import {
  findRecurrenceOccurrence,
  hasRecurrenceOccurrenceInRange,
} from '../calendar.recurrence';
import {
  buildCalendarParticipantEmailFilter,
  replaceCalendarEventParticipants,
  selectUniqueCalendarParticipantsByEmail,
} from '../calendar-participant.utils';
import {
  type AzureCalendarViewResponse,
  type AzureGraphCalendarEvent,
  type AzureOutlookCategoriesResponse,
  type AzureOutlookCategory,
  buildAzureCalendarEvent,
  buildAzureCalendarEventPatch,
  type ImportAzureCalendarEventsRange,
  isAzureAuthenticationError,
  isAzureForbiddenError,
  isAzureNotFoundError,
  normalizeAzureDateTime,
  normalizeAzureEmail,
  normalizeAzureRecurrenceRule,
  resolveAzureOnlineMeetingUrl,
  resolveAzureSeriesImportEvents,
  truncateAzureText,
} from './azure-calendar.utils';

const AZURE_EVENT_SELECT =
  'id,iCalUId,type,seriesMasterId,subject,bodyPreview,body,sensitivity,start,end,isAllDay,isCancelled,attendees,categories,isOnlineMeeting,onlineMeetingProvider,onlineMeeting,onlineMeetingUrl,locations,recurrence';

type MissingProviderItemResolution = 'missing' | 'updated' | 'unchanged';

export class AzureCalendarOperations {
  protected createClient(accessToken: string): Client {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
    return client;
  }

  protected async fetchCalendarViewWithRetry(
    session: PersonSessionItem,
    accessToken: string,
    range: ImportAzureCalendarEventsRange,
  ): Promise<AzureGraphCalendarEvent[]> {
    try {
      return await this.fetchCalendarView(accessToken, range);
    } catch (error) {
      if (!isAzureAuthenticationError(error)) {
        throw error;
      }

      const refreshedToken = await this.refreshAzureAccessToken(session);
      if (!refreshedToken) {
        throw error;
      }

      return this.fetchCalendarView(refreshedToken, range);
    }
  }

  protected async fetchMasterCategoriesWithRetry(
    session: PersonSessionItem,
    accessToken: string,
  ): Promise<AzureOutlookCategory[]> {
    try {
      return await this.fetchMasterCategories(accessToken);
    } catch (error) {
      if (!isAzureAuthenticationError(error)) {
        throw error;
      }

      let refreshedToken: string | null;
      try {
        refreshedToken = await this.refreshAzureAccessToken(session);
      } catch (refreshError) {
        if (isAzureForbiddenError(error)) {
          throw error;
        }
        throw refreshError;
      }
      if (!refreshedToken) {
        throw error;
      }

      return this.fetchMasterCategories(refreshedToken);
    }
  }

  protected async fetchCalendarView(
    accessToken: string,
    range: ImportAzureCalendarEventsRange,
  ): Promise<AzureGraphCalendarEvent[]> {
    const client = this.createClient(accessToken);
    const events: AzureGraphCalendarEvent[] = [];
    let response = (await client
      .api('/me/calendarView')
      .query({
        startDateTime: range.startDateTime.toISOString(),
        endDateTime: range.endDateTime.toISOString(),
        $select: AZURE_EVENT_SELECT,
        $top: '100',
      })
      .header('Prefer', 'outlook.timezone="UTC"')
      .get()) as AzureCalendarViewResponse;

    events.push(...(response.value ?? []));

    while (response['@odata.nextLink']) {
      response = (await client
        .api(response['@odata.nextLink'])
        .header('Prefer', 'outlook.timezone="UTC"')
        .get()) as AzureCalendarViewResponse;
      events.push(...(response.value ?? []));
    }

    return resolveAzureSeriesImportEvents(events, async (seriesMasterId) => {
      try {
        return (await client
          .api(`/me/events/${seriesMasterId}`)
          .query({ $select: AZURE_EVENT_SELECT })
          .header('Prefer', 'outlook.timezone="UTC"')
          .get()) as AzureGraphCalendarEvent;
      } catch (error) {
        // The series can disappear between calendarView and the master lookup.
        // In that race, skip its instances instead of importing duplicates.
        if (isAzureNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  }

  protected async fetchMasterCategories(
    accessToken: string,
  ): Promise<AzureOutlookCategory[]> {
    const client = this.createClient(accessToken);
    const categories: AzureOutlookCategory[] = [];
    let response = (await client
      .api('/me/outlook/masterCategories')
      .query({
        $select: 'id,displayName,color',
        $top: '100',
      })
      .get()) as AzureOutlookCategoriesResponse;

    categories.push(...(response.value ?? []));

    while (response['@odata.nextLink']) {
      response = (await client
        .api(response['@odata.nextLink'])
        .get()) as AzureOutlookCategoriesResponse;
      categories.push(...(response.value ?? []));
    }

    return categories;
  }

  protected async refreshAzureAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const refreshToken = session.refreshToken?.trim();
    if (!refreshToken) {
      return null;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENNANT_ID || 'common'}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: AZURE_AD_CLIENT_ID,
      client_secret: AZURE_AD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (AZURE_AD_SCOPE.length > 0) {
      params.set('scope', AZURE_AD_SCOPE.join(' '));
    }

    const response = await axios.post<{ access_token?: string }>(
      tokenEndpoint,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const accessToken = response.data.access_token?.trim() ?? null;
    if (accessToken) {
      session.accessToken = accessToken;
    }

    return accessToken;
  }

  protected async resolveAzureAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const directToken = session.accessToken?.trim();
    if (directToken) {
      return directToken;
    }

    return this.refreshAzureAccessToken(session);
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
      provider: 'azure',
    });
    return subscription?.classificationMappings ?? [];
  }

  protected async upsertImportedEvent(
    emFork: EntityManager,
    graphEvent: AzureGraphCalendarEvent,
    defaults: {
      user: PersonItem;
      type: EventTypeItem;
      category: EventCategoryItem;
      scheduledStatus: EventStatusItem;
      canceledStatus: EventStatusItem;
    },
  ): Promise<'created' | 'updated' | 'skipped'> {
    const referenceHandle = graphEvent.id?.trim();
    const iCalUId = graphEvent.iCalUId?.trim() || null;
    const providerStartDate = normalizeAzureDateTime(graphEvent.start);
    const providerEndDate = normalizeAzureDateTime(graphEvent.end);
    const occurrenceStartDate = normalizeAzureDateTime(
      graphEvent.saplingImportOccurrence?.start,
    );
    const occurrenceEndDate = normalizeAzureDateTime(
      graphEvent.saplingImportOccurrence?.end,
    );
    const startDate = occurrenceStartDate ?? providerStartDate;
    const endDate = occurrenceEndDate ?? providerEndDate;
    const recurrenceRule = rebaseImportedRecurrenceRule(
      normalizeAzureRecurrenceRule(graphEvent.recurrence),
      providerStartDate,
      occurrenceStartDate,
    );

    if (!referenceHandle || !startDate || !endDate) {
      return 'skipped';
    }

    // Microsoft Graph event ids identify one mailbox copy. Invitations shared
    // by an organizer and attendees therefore have different ids, while
    // iCalUId identifies the meeting across those calendars. Prefer that
    // calendar-wide identity and fall back to the legacy mailbox id so existing
    // projection rows are backfilled on their next import.
    const populateOptions = {
      populate: ['event', 'event.participants', 'event.status'],
    } as const;
    const reference =
      (iCalUId
        ? await emFork.findOne(
            EventAzureItem,
            { iCalUId },
            populateOptions as never,
          )
        : null) ??
      (await emFork.findOne(
        EventAzureItem,
        { referenceHandle },
        populateOptions as never,
      ));

    if (graphEvent.isCancelled === true && !reference) {
      return 'skipped';
    }

    const status =
      graphEvent.isCancelled === true
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
      classification: {
        type: defaults.type,
        category: defaults.category,
      },
    });

    const newReference = new EventAzureItem();
    newReference.event = event;
    newReference.referenceHandle = referenceHandle;
    newReference.iCalUId = iCalUId;

    emFork.persist(event);
    emFork.persist(newReference);
    return 'created';
  }

  protected async assignImportedEvent(
    event: EventItem,
    graphEvent: AzureGraphCalendarEvent,
    values: {
      startDate: Date;
      endDate: Date;
      status: EventStatusItem;
      participants: PersonItem[];
      recurrenceRule: string | null;
      classification?: {
        type: EventTypeItem;
        category: EventCategoryItem;
      };
    },
  ): Promise<void> {
    event.title = truncateAzureText(
      graphEvent.subject?.trim() || 'Outlook event',
      128,
    );
    event.description = graphEvent.bodyPreview?.trim() || undefined;
    event.isPrivate = graphEvent.sensitivity === 'private';
    event.startDate = values.startDate;
    event.endDate = values.endDate;
    if (values.classification) {
      event.type = values.classification.type;
      event.category = values.classification.category;
    }
    event.recurrenceRule = values.recurrenceRule;
    event.isAllDay = graphEvent.isAllDay === true;
    const onlineMeetingURL = resolveAzureOnlineMeetingUrl(graphEvent);
    event.onlineMeetingURL = onlineMeetingURL ?? event.onlineMeetingURL;
    event.createOnlineMeeting = Boolean(
      graphEvent.isOnlineMeeting || onlineMeetingURL,
    );
    event.status = values.status;
    await replaceCalendarEventParticipants(event, values.participants);
  }

  protected async resolveImportedParticipants(
    emFork: EntityManager,
    graphEvent: AzureGraphCalendarEvent,
    user: PersonItem,
  ): Promise<PersonItem[]> {
    const attendeeEmails = Array.from(
      new Set(
        (graphEvent.attendees ?? [])
          .map((attendee) =>
            normalizeAzureEmail(attendee.emailAddress?.address),
          )
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

    // Graph does not list the organizer as an attendee. Keep a participant
    // fallback only for personal appointments without an attendee list. A
    // meeting organized for other people must not silently add the organizer
    // to Sapling's participant collection.
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
    graphEvents: AzureGraphCalendarEvent[],
    range: ImportAzureCalendarEventsRange,
    user: PersonItem,
    completedStatus: EventStatusItem,
    resolveMissingProviderItem: (
      reference: EventAzureItem,
    ) => Promise<MissingProviderItemResolution>,
  ): Promise<number> {
    if (typeof user.handle !== 'number') {
      return 0;
    }

    const references = await emFork.find(
      EventAzureItem,
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
    const returnedICalUIds = new Set(
      graphEvents
        .map((event) => event.iCalUId?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    const returnedReferenceHandles = new Set(
      graphEvents
        .map((event) => event.id?.trim())
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
      if (!expectedInRange) {
        continue;
      }

      const providerItemReturned = reference.iCalUId
        ? returnedICalUIds.has(reference.iCalUId)
        : returnedReferenceHandles.has(reference.referenceHandle);
      if (providerItemReturned) {
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

  protected async fetchAzureEventByReference(
    accessToken: string,
    referenceHandle: string,
    futureStart: Date,
  ): Promise<AzureGraphCalendarEvent | null> {
    const client = this.createClient(accessToken);
    let graphEvent: AzureGraphCalendarEvent;
    try {
      graphEvent = (await client
        .api(`/me/events/${referenceHandle}`)
        .query({ $select: AZURE_EVENT_SELECT })
        .header('Prefer', 'outlook.timezone="UTC"')
        .get()) as AzureGraphCalendarEvent;
    } catch (error) {
      if (isAzureNotFoundError(error)) {
        return null;
      }
      throw error;
    }

    if (!graphEvent.recurrence) {
      return graphEvent;
    }

    // A series master carries its historical start. Load its next concrete
    // occurrence so a moved series is immediately anchored at a future date.
    const futureEnd = new Date(futureStart);
    futureEnd.setUTCFullYear(futureEnd.getUTCFullYear() + 5);
    const instances = (await client
      .api(`/me/events/${referenceHandle}/instances`)
      .query({
        startDateTime: futureStart.toISOString(),
        endDateTime: futureEnd.toISOString(),
        $select: 'id,start,end,type',
        $top: '1',
      })
      .header('Prefer', 'outlook.timezone="UTC"')
      .get()) as AzureCalendarViewResponse;
    const nextOccurrence = (instances.value ?? [])
      .filter((event) => normalizeAzureDateTime(event.start))
      .sort(
        (left, right) =>
          normalizeAzureDateTime(left.start)!.getTime() -
          normalizeAzureDateTime(right.start)!.getTime(),
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
   * Creates a new event in the Azure calendar using Microsoft Graph API.
   * @param {Client} client Authenticated Microsoft Graph Client
   * @param {EventItem} event The event to create
   * @param {EntityManager} emFork Forked EntityManager for database operations
   * @returns {Promise<any>} The created event object from Microsoft Graph API
   */
  protected async createEvent(
    client: Client,
    event: EventItem,
    emFork: EntityManager,
    classificationMappings?: CalendarClassificationMapping[] | null,
  ): Promise<any> {
    const eventResource = buildAzureCalendarEvent(
      event,
      classificationMappings,
    );

    // Create event in Azure
    const created = (await client.api('/me/events').post(eventResource)) as {
      id: string;
      iCalUId?: string | null;
      onlineMeeting: { joinUrl: string };
    };

    // Create EventAzureItem with Azure event ID and save
    const reference = new EventAzureItem();
    reference.event = event;
    reference.referenceHandle = created.id;
    reference.iCalUId = created.iCalUId?.trim() || null;
    await emFork.persist(reference).flush();

    if (event.createOnlineMeeting && created.onlineMeeting?.joinUrl) {
      event.onlineMeetingURL = created.onlineMeeting.joinUrl;
      await emFork.persist(event).flush();
    }
    return created;
  }

  /**
   * Updates an existing event in the Azure calendar using Microsoft Graph API.
   * @param {Client} client Authenticated Microsoft Graph Client
   * @param {EventItem} event The updated event data
   * @param {EventAzureItem} reference The EventAzureItem containing the Azure event ID
   * @param {EntityManager} emFork Forked EntityManager for database operations
   * @returns {Promise<any>} The updated event object from Microsoft Graph API
   */
  protected async updateEvent(
    client: Client,
    event: EventItem,
    reference: EventAzureItem,
    emFork: EntityManager,
    classificationMappings?: CalendarClassificationMapping[] | null,
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
  ): Promise<any> {
    if (operation === 'remove-recurrence') {
      const resource = buildAzureCalendarEvent(event, classificationMappings);
      return await client.api(`/me/events/${reference.referenceHandle}`).patch({
        start: resource.start,
        end: resource.end,
        recurrence: null,
      });
    }

    const eventResource = buildAzureCalendarEventPatch(
      event,
      classificationMappings,
      changedFields,
    );

    if (Object.keys(eventResource).length === 0) {
      return { id: reference.referenceHandle, unchanged: true };
    }

    // PATCH Event (without online meeting fields)
    const patchResult = (await client
      .api(`/me/events/${reference.referenceHandle}`)
      .patch(eventResource)) as {
      id: string;
      onlineMeeting: { joinUrl: string };
    };

    if (event.createOnlineMeeting && patchResult.onlineMeeting?.joinUrl) {
      event.onlineMeetingURL = patchResult.onlineMeeting.joinUrl;
      await emFork.persist(event).flush();
    }

    return patchResult;
  }

  /**
   * Deletes an event from the Azure calendar and removes its reference from the database.
   * @param {Client} client Authenticated Microsoft Graph Client
   * @param {EventAzureItem} reference The EventAzureItem containing the Azure event ID
   * @param {EntityManager} emFork Forked EntityManager for database operations
   * @returns {Promise<any>} An object indicating success
   */
  protected async deleteEvent(
    client: Client,
    reference: EventAzureItem,
    emFork: EntityManager,
  ): Promise<any> {
    try {
      await client.api(`/me/events/${reference.referenceHandle}`).delete();
    } catch (error) {
      if (!isAzureNotFoundError(error)) {
        throw error;
      }
    }

    // Remove the EventAzureItem from the database
    await emFork.remove(reference).flush();
    return { success: true };
  }

  protected async detachOccurrence(
    client: Client,
    reference: EventAzureItem,
    occurrenceStartValue: string,
  ): Promise<Record<string, unknown>> {
    const occurrenceStart = new Date(occurrenceStartValue);
    if (Number.isNaN(occurrenceStart.getTime())) {
      throw new Error('calendar.invalidOccurrenceStart');
    }

    const rangeStart = new Date(occurrenceStart.getTime() - 60_000);
    const rangeEnd = new Date(occurrenceStart.getTime() + 24 * 60 * 60_000);
    const response = (await client
      .api(`/me/events/${reference.referenceHandle}/instances`)
      .query({
        startDateTime: rangeStart.toISOString(),
        endDateTime: rangeEnd.toISOString(),
        $select: 'id,start,originalStart,type',
      })
      .header('Prefer', 'outlook.timezone="UTC"')
      .get()) as AzureCalendarViewResponse;

    const targetTimestamp = occurrenceStart.getTime();
    const occurrence = (response.value ?? []).find((candidate) => {
      const originalStart = normalizeAzureOccurrenceStart(
        candidate.originalStart,
      );
      const currentStart = normalizeAzureDateTime(candidate.start);
      return (
        originalStart?.getTime() === targetTimestamp ||
        currentStart?.getTime() === targetTimestamp
      );
    });

    if (!occurrence?.id) {
      return { success: true, unchanged: true };
    }

    await client.api(`/me/events/${occurrence.id}`).delete();
    return { success: true, detachedOccurrenceId: occurrence.id };
  }
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

function normalizeAzureOccurrenceStart(value?: string | null): Date | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRelationHandle(
  value?: string | { handle?: string } | null,
): string {
  return typeof value === 'string' ? value : (value?.handle ?? '');
}
