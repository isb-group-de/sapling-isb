/**
 * @class GoogleCalendarService
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service for managing calendar events in Google Calendar via Google Calendar API.
 * Handles creation, update, deletion, and queuing of events for Google calendars.
 * Integrates with EventDeliveryService for event delivery and uses MikroORM for persistence.
 *
 * @property        {EventDeliveryService} eventDeliveryService Service for event delivery and queuing
 * @property        {EntityManager} em                         MikroORM EntityManager for database operations
 *
 * @method          queueEvent           Queues an event for delivery to Google calendar
 * @method          setEvent             Sets (creates, updates, or deletes) an event in Google calendar
 * @method          createEvent          Creates a new event in Google calendar
 * @method          updateEvent          Updates an existing event in Google calendar
 * @method          deleteEvent          Deletes an event from Google calendar and removes reference
 * @method          getGoogleEvent       Maps EventItem to Google Calendar event resource
 */
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { EventItem } from '../../entity/EventItem';
import { EventDeliveryService } from '../event.delivery.service';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { EntityManager } from '@mikro-orm/core';
import { EventGoogleItem } from '../../entity/EventGoogleItem';
import { PersonItem } from '../../entity/PersonItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import { CalendarSyncSubscriptionItem } from '../../entity/CalendarSyncSubscriptionItem';
import { ImportGoogleCalendarEventsResponseDto } from './dto/import-google-calendar-events.dto';
import {
  clampGoogleImportRangeToFuture,
  type ImportGoogleCalendarEventsRange,
  isGoogleAuthenticationError,
  isGoogleNotFoundError,
  SAPLING_GOOGLE_EVENT_CATEGORY_KEY,
  SAPLING_GOOGLE_EVENT_TYPE_KEY,
} from './google-calendar.utils';
import {
  DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
  DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
  resolveImportedCalendarClassification,
} from '../calendar-classification.utils';
import {
  getRelationHandle,
  GoogleCalendarOperations,
} from './google-calendar.operations';

/**
 * Service for managing calendar events in Google Calendar via Google Calendar API.
 * Handles creation, update, deletion, and queuing of events for Google calendars.
 * Integrates with EventDeliveryService for event delivery and uses MikroORM for persistence.
 */
@Injectable()
export class GoogleCalendarService extends GoogleCalendarOperations {
  /**
   * Creates a new GoogleCalendarService.
   * @param {EventDeliveryService} eventDeliveryService Service for event delivery and queuing
   * @param {EntityManager} em MikroORM EntityManager for database operations
   */
  constructor(
    @Inject(forwardRef(() => EventDeliveryService))
    private readonly eventDeliveryService: EventDeliveryService,
    private readonly em: EntityManager,
  ) {
    super();
  }

  /**
   * Queues an event for delivery to Google calendar using the EventDeliveryService.
   * If Redis is disabled, logs a warning and does not queue the event.
   * @param {EventItem} event The event to queue
   * @param {PersonSessionItem} session The user session containing access tokens
   * @returns {Promise<any>} The result of the queue operation or null if Redis is disabled
   */
  async queueEvent(
    event: EventItem,
    session: PersonSessionItem,
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
    occurrenceStart?: string,
  ) {
    if (typeof session.handle !== 'number') {
      throw new Error('calendar.sessionHandleRequired');
    }

    // Use EventDeliveryService to create delivery and queue
    return await this.eventDeliveryService.queueEventDelivery(event, {
      provider: 'google',
      sessionHandle: session.handle,
      ...(operation ? { operation } : {}),
      ...(changedFields ? { changedFields } : {}),
      ...(occurrenceStart ? { occurrenceStart } : {}),
    });
  }

  /**
   * Deletes an existing Google projection before its Sapling Event is
   * physically removed. The Event creator owns the calendar projection and its
   * persisted session therefore supplies the provider credentials.
   */
  async deleteSynchronizedEvent(
    eventHandle: number,
    ownerPersonHandle: number,
  ): Promise<boolean> {
    const emFork = this.em.fork();
    const reference = await emFork.findOne(EventGoogleItem, {
      event: eventHandle as never,
    });
    if (!reference) {
      return false;
    }

    const session = await emFork.findOne(PersonSessionItem, {
      person: { handle: ownerPersonHandle },
    });
    if (!session) {
      throw new UnauthorizedException('calendar.googleSessionNotFound');
    }

    const accessToken = await this.resolveGoogleAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('calendar.googleTokenNotAvailable');
    }

    const deleteWithToken = (token: string) =>
      this.deleteEvent(
        google.calendar({ version: 'v3' }),
        reference,
        token,
        emFork,
      );

    try {
      await deleteWithToken(accessToken);
    } catch (error) {
      if (!isGoogleAuthenticationError(error)) {
        throw error;
      }
      const refreshedToken = await this.refreshGoogleAccessToken(session);
      if (!refreshedToken) {
        throw error;
      }
      await deleteWithToken(refreshedToken);
    }

    return true;
  }

  /**
   * Sets (creates, updates, or deletes) an event in the Google calendar based on its status.
   * - If the event is canceled and exists in Google, it will be deleted.
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
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
    occurrenceStart?: string,
  ): Promise<unknown> {
    void occurrenceStart;
    const calendar = google.calendar({ version: 'v3' });
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

    const reference = await emFork.findOne(EventGoogleItem, {
      event: event.handle as never,
    });

    switch (event.status.handle) {
      case 'canceled':
        if (reference) {
          return await this.deleteEvent(
            calendar,
            reference,
            accessToken,
            emFork,
          );
        }
        break;
      case 'completed':
        // Completion is internal to Sapling. This also protects against older
        // pending deliveries that were queued before completion was separated
        // from cancellation.
        return null;
      default:
        if (reference) {
          try {
            return await this.updateEvent(
              calendar,
              event,
              reference,
              accessToken,
              emFork,
              classificationMappings,
              operation,
              changedFields,
            );
          } catch (error) {
            if (!isGoogleNotFoundError(error)) {
              throw error;
            }
            await emFork.remove(reference).flush();
            return await this.createEvent(
              calendar,
              event,
              accessToken,
              emFork,
              classificationMappings,
            );
          }
        } else {
          return await this.createEvent(
            calendar,
            event,
            accessToken,
            emFork,
            classificationMappings,
          );
        }
    }
  }

  async importEvents(
    currentUser: PersonItem,
    range: ImportGoogleCalendarEventsRange,
  ): Promise<ImportGoogleCalendarEventsResponseDto> {
    if (
      Number.isNaN(range.startDateTime.getTime()) ||
      Number.isNaN(range.endDateTime.getTime()) ||
      range.startDateTime > range.endDateTime
    ) {
      throw new BadRequestException('calendar.invalidImportRange');
    }

    if (this.getPersonTypeHandle(currentUser) !== 'google') {
      throw new ForbiddenException('calendar.googleUserRequired');
    }

    const importRange = clampGoogleImportRangeToFuture(range);
    if (!importRange) {
      return { imported: 0, created: 0, updated: 0, skipped: 0 };
    }

    const emFork = this.em.fork();
    const session = await emFork.findOne(PersonSessionItem, {
      person: { handle: currentUser.handle },
    });

    if (!session) {
      throw new UnauthorizedException('calendar.googleSessionNotFound');
    }

    const accessToken = await this.resolveGoogleAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('calendar.googleTokenNotAvailable');
    }

    const graphEvents = await this.fetchCalendarEventsWithRetry(
      session,
      accessToken,
      importRange,
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
      completedStatus,
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
      emFork.findOne(EventStatusItem, { handle: 'completed' }),
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

    if (!user || this.getPersonTypeHandle(user) !== 'google') {
      throw new ForbiddenException('calendar.googleUserRequired');
    }

    if (!user.company) {
      throw new BadRequestException('calendar.importDefaultsMissing');
    }

    const result: ImportGoogleCalendarEventsResponseDto = {
      imported: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };

    if (
      !defaultType ||
      !defaultCategory ||
      !scheduledStatus ||
      !canceledStatus ||
      !completedStatus
    ) {
      result.skipped = graphEvents.length;
      return result;
    }

    const activeGraphEvents = graphEvents.filter(
      (graphEvent) => graphEvent.status !== 'cancelled',
    );
    for (const graphEvent of activeGraphEvents) {
      const privateProperties = graphEvent.extendedProperties?.private;
      const classification = resolveImportedCalendarClassification({
        mappings: subscription?.classificationMappings,
        externalValues: [graphEvent.colorId],
        embeddedEventTypeHandle:
          privateProperties?.[SAPLING_GOOGLE_EVENT_TYPE_KEY],
        embeddedEventCategoryHandle:
          privateProperties?.[SAPLING_GOOGLE_EVENT_CATEGORY_KEY],
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

    const reconciled = await this.reconcileMissingImportedEvents(
      emFork,
      activeGraphEvents,
      importRange,
      user,
      completedStatus,
      async (reference) => {
        const movedGraphEvent = await this.fetchGoogleEventByReference(
          accessToken,
          reference.referenceHandle,
          importRange.startDateTime,
        );
        if (!movedGraphEvent) {
          return 'missing';
        }
        if (
          movedGraphEvent.recurrence?.length &&
          !movedGraphEvent.saplingImportOccurrence
        ) {
          return 'unchanged';
        }

        const privateProperties = movedGraphEvent.extendedProperties?.private;
        const classification = resolveImportedCalendarClassification({
          mappings: subscription?.classificationMappings,
          externalValues: [movedGraphEvent.colorId],
          embeddedEventTypeHandle:
            privateProperties?.[SAPLING_GOOGLE_EVENT_TYPE_KEY],
          embeddedEventCategoryHandle:
            privateProperties?.[SAPLING_GOOGLE_EVENT_CATEGORY_KEY],
          defaults: {
            eventTypeHandle: defaultType.handle,
            eventCategoryHandle: defaultCategory.handle,
          },
        });
        const saved = await this.upsertImportedEvent(emFork, movedGraphEvent, {
          user,
          type:
            eventTypesByHandle.get(classification.eventTypeHandle) ??
            defaultType,
          category:
            eventCategoriesByHandle.get(classification.eventCategoryHandle) ??
            defaultCategory,
          scheduledStatus,
          canceledStatus,
        });
        return saved === 'updated' ? 'updated' : 'unchanged';
      },
    );
    result.updated += reconciled;
    result.imported += reconciled;

    await emFork.flush();
    return result;
  }
}
