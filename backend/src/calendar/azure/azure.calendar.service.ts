/**
 * @class AzureCalendarService
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service for managing calendar events in Microsoft Azure (Outlook) via Microsoft Graph API.
 * Handles creation, update, deletion, and queuing of events for Azure calendars.
 * Integrates with EventDeliveryService for event delivery and uses MikroORM for persistence.
 *
 * @property        {EventDeliveryService} eventDeliveryService Service for event delivery and queuing
 * @property        {EntityManager} em                         MikroORM EntityManager for database operations
 *
 * @method          queueEvent           Queues an event for delivery to Azure calendar
 * @method          setEvent             Sets (creates, updates, or deletes) an event in Azure calendar
 * @method          createClient         Creates a Microsoft Graph API client for the given access token
 * @method          createEvent          Creates a new event in Azure calendar
 * @method          updateEvent          Updates an existing event in Azure calendar
 * @method          deleteEvent          Deletes an event from Azure calendar and removes reference
 * @method          getAzureEvent        Maps EventItem to Azure Calendar event resource
 */
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import axios from 'axios';
import { EventItem } from '../../entity/EventItem';
import { EventDeliveryService } from '../event.delivery.service';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { EntityManager } from '@mikro-orm/core';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { PersonItem } from '../../entity/PersonItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import { CalendarSyncSubscriptionItem } from '../../entity/CalendarSyncSubscriptionItem';
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AZURE_AD_SCOPE,
  AZURE_AD_TENNANT_ID,
} from '../../constants/project.constants';
import { ImportAzureCalendarEventsResponseDto } from './dto/import-azure-calendar-events.dto';
import {
  type AzureCalendarViewResponse,
  type AzureGraphCalendarEvent,
  type AzureOutlookCategoriesResponse,
  type AzureOutlookCategory,
  type AzureOutlookMasterCategory,
  buildAzureCalendarEvent,
  type ImportAzureCalendarEventsRange,
  isAzureAuthenticationError,
  isAzureForbiddenError,
  normalizeAzureDateTime,
  normalizeAzureEmail,
  truncateAzureText,
} from './azure-calendar.utils';
import {
  type CalendarClassificationMapping,
  DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
  DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
  resolveImportedCalendarClassification,
} from '../calendar-classification.utils';

/**
 * Service for managing calendar events in Microsoft Azure (Outlook) via Microsoft Graph API.
 * Handles creation, update, deletion, and queuing of events for Azure calendars.
 * Integrates with EventDeliveryService for event delivery and uses MikroORM for persistence.
 */
@Injectable()
export class AzureCalendarService {
  /**
   * Creates a new AzureCalendarService.
   * @param {EventDeliveryService} eventDeliveryService Service for event delivery and queuing
   * @param {EntityManager} em MikroORM EntityManager for database operations
   */
  constructor(
    @Inject(forwardRef(() => EventDeliveryService))
    private readonly eventDeliveryService: EventDeliveryService,
    private readonly em: EntityManager,
  ) {}

  /**
   * Queues an event for delivery to Azure calendar using the EventDeliveryService.
   * If Redis is disabled, logs a warning and does not queue the event.
   * @param {EventItem} event The event to queue
   * @param {PersonSessionItem} session The user session containing access tokens
   * @returns {Promise<any>} The result of the queue operation or null if Redis is disabled
   */
  async queueEvent(
    event: EventItem,
    session: PersonSessionItem,
    operation?: 'remove-recurrence',
  ) {
    if (typeof session.handle !== 'number') {
      throw new Error('calendar.sessionHandleRequired');
    }

    // Use EventDeliveryService to create delivery and queue
    return await this.eventDeliveryService.queueEventDelivery(event, {
      provider: 'azure',
      sessionHandle: session.handle,
      ...(operation ? { operation } : {}),
    });
  }

  /**
   * Sets (creates, updates, or deletes) an event in the Azure calendar based on its status.
   * - If the event is canceled and exists in Azure, it will be deleted.
   * - If the event exists, it will be updated.
   * - Otherwise, a new event will be created.
   * @param {number} eventHandle Handle of the EventItem to synchronize
   * @param {string} accessToken OAuth access token of the calling user
   * @returns {Promise<any>} The result of the operation (create, update, or delete)
   */
  async setEvent(
    eventHandle: number,
    accessToken: string,
    personHandle?: number,
    operation?: 'remove-recurrence',
  ): Promise<any> {
    const client = this.createClient(accessToken);
    // Fork EntityManager for context-specific actions
    const emFork = this.em.fork();
    const event = await emFork.findOne(
      EventItem,
      { handle: eventHandle },
      { populate: ['participants', 'status', 'type', 'category'] },
    );
    const classificationMappings = await this.loadClassificationMappings(
      emFork,
      personHandle,
    );

    if (!event) {
      throw new Error('calendar.eventNotFound');
    }

    if (!event.status) {
      return null;
    }

    if (operation === 'remove-recurrence') {
      event.recurrenceRule = null;
    }

    const reference = await emFork.findOne(EventAzureItem, {
      event: event.handle as never,
    });

    switch (event.status.handle) {
      case 'canceled':
      case 'completed':
        if (reference) {
          return await this.deleteEvent(client, reference, emFork);
        }
        break;
      default:
        if (reference) {
          return await this.updateEvent(
            client,
            event,
            reference,
            emFork,
            classificationMappings,
            operation,
          );
        } else {
          return await this.createEvent(
            client,
            event,
            emFork,
            classificationMappings,
          );
        }
    }
  }

  async importEvents(
    currentUser: PersonItem,
    range: ImportAzureCalendarEventsRange,
  ): Promise<ImportAzureCalendarEventsResponseDto> {
    if (
      Number.isNaN(range.startDateTime.getTime()) ||
      Number.isNaN(range.endDateTime.getTime()) ||
      range.startDateTime > range.endDateTime
    ) {
      throw new BadRequestException('calendar.invalidImportRange');
    }

    if (this.getPersonTypeHandle(currentUser) !== 'azure') {
      throw new ForbiddenException('calendar.azureUserRequired');
    }

    const emFork = this.em.fork();
    const session = await emFork.findOne(PersonSessionItem, {
      person: { handle: currentUser.handle },
    });

    if (!session) {
      throw new UnauthorizedException('calendar.azureSessionNotFound');
    }

    const accessToken = await this.resolveAzureAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('calendar.azureTokenNotAvailable');
    }

    const graphEvents = await this.fetchCalendarViewWithRetry(
      session,
      accessToken,
      range,
    );

    const user = await emFork.findOne(
      PersonItem,
      { handle: currentUser.handle },
      { populate: ['company', 'type'] },
    );
    const [
      subscription,
      eventTypes,
      eventCategories,
      scheduledStatus,
      canceledStatus,
    ] = await Promise.all([
      emFork.findOne(
        CalendarSyncSubscriptionItem,
        { person: { handle: currentUser.handle } },
        { populate: ['defaultEventType', 'defaultEventCategory'] },
      ),
      emFork.find(EventTypeItem, {}),
      emFork.find(EventCategoryItem, {}),
      emFork.findOne(EventStatusItem, { handle: 'scheduled' }),
      emFork.findOne(EventStatusItem, { handle: 'canceled' }),
    ]);
    const eventTypesByHandle = new Map(
      eventTypes.map((eventType) => [eventType.handle, eventType]),
    );
    const eventCategoriesByHandle = new Map(
      eventCategories.map((eventCategory) => [
        eventCategory.handle,
        eventCategory,
      ]),
    );
    const defaultType =
      eventTypesByHandle.get(
        getRelationHandle(subscription?.defaultEventType),
      ) ?? eventTypesByHandle.get(DEFAULT_CALENDAR_EVENT_TYPE_HANDLE);
    const defaultCategory =
      eventCategoriesByHandle.get(
        getRelationHandle(subscription?.defaultEventCategory),
      ) ?? eventCategoriesByHandle.get(DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE);

    if (!user || this.getPersonTypeHandle(user) !== 'azure') {
      throw new ForbiddenException('calendar.azureUserRequired');
    }

    if (!user.company) {
      throw new BadRequestException('calendar.importDefaultsMissing');
    }

    const result: ImportAzureCalendarEventsResponseDto = {
      imported: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };

    if (
      !defaultType ||
      !defaultCategory ||
      !scheduledStatus ||
      !canceledStatus
    ) {
      result.skipped = graphEvents.length;
      return result;
    }

    for (const graphEvent of graphEvents) {
      const classification = resolveImportedCalendarClassification({
        mappings: subscription?.classificationMappings,
        externalValues: graphEvent.categories,
        defaults: {
          eventTypeHandle: defaultType.handle,
          eventCategoryHandle: defaultCategory.handle,
        },
      });
      const saved = await this.upsertImportedEvent(emFork, graphEvent, {
        user,
        type:
          eventTypesByHandle.get(classification.eventTypeHandle) ?? defaultType,
        category:
          eventCategoriesByHandle.get(classification.eventCategoryHandle) ??
          defaultCategory,
        scheduledStatus,
        canceledStatus,
      });

      if (saved === 'created') {
        result.created += 1;
        result.imported += 1;
      } else if (saved === 'updated') {
        result.updated += 1;
        result.imported += 1;
      } else {
        result.skipped += 1;
      }
    }

    await emFork.flush();
    return result;
  }

  async getMasterCategories(
    currentUser: PersonItem,
  ): Promise<AzureOutlookMasterCategory[]> {
    if (this.getPersonTypeHandle(currentUser) !== 'azure') {
      throw new ForbiddenException('calendar.azureUserRequired');
    }

    const emFork = this.em.fork();
    const session = await emFork.findOne(PersonSessionItem, {
      person: { handle: currentUser.handle },
    });
    if (!session) {
      throw new UnauthorizedException('calendar.azureSessionNotFound');
    }

    const accessToken = await this.resolveAzureAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('calendar.azureTokenNotAvailable');
    }

    let categories: AzureOutlookCategory[];
    try {
      categories = await this.fetchMasterCategoriesWithRetry(
        session,
        accessToken,
      );
    } catch (error) {
      if (isAzureForbiddenError(error)) {
        throw new ForbiddenException(
          'calendarSyncSubscription.outlookCategoryPermissionMissing',
        );
      }
      throw error;
    }
    return categories
      .flatMap((category): AzureOutlookMasterCategory[] => {
        const displayName = category.displayName?.trim();
        if (!displayName) {
          return [];
        }
        return [
          {
            id: category.id?.trim() || undefined,
            displayName,
            color: category.color?.trim() || undefined,
          },
        ];
      })
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: 'base',
        }),
      );
  }

  /**
   * Creates a Microsoft Graph API client for the given access token.
   * @param {string} accessToken The OAuth access token for the user
   * @returns {Client} An authenticated Microsoft Graph Client instance
   */
  private createClient(accessToken: string): Client {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
    return client;
  }

  private async fetchCalendarViewWithRetry(
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

  private async fetchMasterCategoriesWithRetry(
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

  private async fetchCalendarView(
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
        $select:
          'id,subject,bodyPreview,sensitivity,start,end,isAllDay,isCancelled,attendees,categories,onlineMeeting,onlineMeetingUrl',
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

    return events;
  }

  private async fetchMasterCategories(
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

  private async refreshAzureAccessToken(
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

  private async resolveAzureAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const directToken = session.accessToken?.trim();
    if (directToken) {
      return directToken;
    }

    return this.refreshAzureAccessToken(session);
  }

  private getPersonTypeHandle(person: PersonItem): string | undefined {
    return person.type?.handle;
  }

  private async loadClassificationMappings(
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

  private async upsertImportedEvent(
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
    const startDate = normalizeAzureDateTime(graphEvent.start);
    const endDate = normalizeAzureDateTime(graphEvent.end);

    if (!referenceHandle || !startDate || !endDate) {
      return 'skipped';
    }

    const reference = await emFork.findOne(
      EventAzureItem,
      { referenceHandle },
      { populate: ['event', 'event.participants'] },
    );

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
      this.assignImportedEvent(reference.event, graphEvent, {
        startDate,
        endDate,
        status,
        participants: participantPeople,
      });
      return 'updated';
    }

    const event = new EventItem();
    event.creatorCompany = defaults.user.company;
    event.creatorPerson = defaults.user;
    event.assigneeCompany = defaults.user.company;
    event.assigneePerson = defaults.user;
    this.assignImportedEvent(event, graphEvent, {
      startDate,
      endDate,
      status,
      participants: participantPeople,
      classification: {
        type: defaults.type,
        category: defaults.category,
      },
    });

    const newReference = new EventAzureItem();
    newReference.event = event;
    newReference.referenceHandle = referenceHandle;

    emFork.persist(event);
    emFork.persist(newReference);
    return 'created';
  }

  private assignImportedEvent(
    event: EventItem,
    graphEvent: AzureGraphCalendarEvent,
    values: {
      startDate: Date;
      endDate: Date;
      status: EventStatusItem;
      participants: PersonItem[];
      classification?: {
        type: EventTypeItem;
        category: EventCategoryItem;
      };
    },
  ): void {
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
    event.isAllDay = graphEvent.isAllDay === true;
    event.onlineMeetingURL =
      graphEvent.onlineMeeting?.joinUrl ??
      graphEvent.onlineMeetingUrl ??
      event.onlineMeetingURL;
    event.status = values.status;
    this.replaceParticipants(event, values.participants);
  }

  private replaceParticipants(event: EventItem, participants: PersonItem[]) {
    const collection = event.participants as {
      set?: (items: PersonItem[]) => void;
      removeAll?: () => void;
      add?: (...items: PersonItem[]) => void;
    };

    if (typeof collection.set === 'function') {
      collection.set(participants);
      return;
    }

    collection.removeAll?.();
    collection.add?.(...participants);
  }

  private async resolveImportedParticipants(
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

    const knownAttendees =
      attendeeEmails.length > 0
        ? await emFork.find(PersonItem, { email: { $in: attendeeEmails } })
        : [];
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
   * Creates a new event in the Azure calendar using Microsoft Graph API.
   * @param {Client} client Authenticated Microsoft Graph Client
   * @param {EventItem} event The event to create
   * @param {EntityManager} emFork Forked EntityManager for database operations
   * @returns {Promise<any>} The created event object from Microsoft Graph API
   */
  private async createEvent(
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
      onlineMeeting: { joinUrl: string };
    };

    // Create EventAzureItem with Azure event ID and save
    const reference = new EventAzureItem();
    reference.event = event;
    reference.referenceHandle = created.id;
    await emFork.persist(reference).flush();

    if (event.type?.handle === 'online' && created.onlineMeeting?.joinUrl) {
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
  private async updateEvent(
    client: Client,
    event: EventItem,
    reference: EventAzureItem,
    emFork: EntityManager,
    classificationMappings?: CalendarClassificationMapping[] | null,
    operation?: 'remove-recurrence',
  ): Promise<any> {
    if (operation === 'remove-recurrence') {
      return await client
        .api(`/me/events/${reference.referenceHandle}`)
        .patch({ recurrence: null });
    }

    const eventResource = buildAzureCalendarEvent(
      event,
      classificationMappings,
    );

    // PATCH Event (without online meeting fields)
    const patchResult = (await client
      .api(`/me/events/${reference.referenceHandle}`)
      .patch(eventResource)) as {
      id: string;
      onlineMeeting: { joinUrl: string };
    };

    if (event.type?.handle === 'online' && patchResult.onlineMeeting?.joinUrl) {
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
  private async deleteEvent(
    client: Client,
    reference: EventAzureItem,
    emFork: EntityManager,
  ): Promise<any> {
    await client.api(`/me/events/${reference.referenceHandle}`).delete();
    // Remove the EventAzureItem from the database
    await emFork.remove(reference).flush();
    return { success: true };
  }
}

function getRelationHandle(
  value?: string | { handle?: string } | null,
): string {
  return typeof value === 'string' ? value : (value?.handle ?? '');
}
