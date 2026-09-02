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
import { ImportAzureCalendarEventsResponseDto } from './dto/import-azure-calendar-events.dto';
import {
  type AzureOutlookCategory,
  type AzureOutlookMasterCategory,
  type ImportAzureCalendarEventsRange,
  isAzureForbiddenError,
  isAzureNotFoundError,
} from './azure-calendar.utils';
import {
  DEFAULT_CALENDAR_EVENT_CATEGORY_HANDLE,
  DEFAULT_CALENDAR_EVENT_TYPE_HANDLE,
  resolveImportedCalendarClassification,
} from '../calendar-classification.utils';
import {
  AzureCalendarOperations,
  getRelationHandle,
} from './azure-calendar.operations';

/**
 * Service for managing calendar events in Microsoft Azure (Outlook) via Microsoft Graph API.
 * Handles creation, update, deletion, and queuing of events for Azure calendars.
 * Integrates with EventDeliveryService for event delivery and uses MikroORM for persistence.
 */
@Injectable()
export class AzureCalendarService extends AzureCalendarOperations {
  /**
   * Creates a new AzureCalendarService.
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
   * Queues an event for delivery to Azure calendar using the EventDeliveryService.
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
      provider: 'azure',
      sessionHandle: session.handle,
      ...(operation ? { operation } : {}),
      ...(changedFields ? { changedFields } : {}),
      ...(occurrenceStart ? { occurrenceStart } : {}),
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
    operation?: 'remove-recurrence' | 'detach-occurrence',
    changedFields?: string[],
    occurrenceStart?: string,
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

    if (operation === 'detach-occurrence') {
      if (!occurrenceStart) {
        throw new Error('calendar.recurrenceOccurrenceReferenceMissing');
      }
      let targetReference = reference;
      if (!targetReference) {
        const created = (await this.createEvent(
          client,
          event,
          emFork,
          classificationMappings,
        )) as { id?: string };
        if (!created.id) {
          throw new Error('calendar.recurrenceOccurrenceReferenceMissing');
        }
        targetReference = {
          event,
          referenceHandle: created.id,
        };
      }
      return this.detachOccurrence(client, targetReference, occurrenceStart);
    }

    switch (event.status.handle) {
      case 'canceled':
        if (reference) {
          return await this.deleteEvent(client, reference, emFork);
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
              client,
              event,
              reference,
              emFork,
              classificationMappings,
              operation,
              changedFields,
            );
          } catch (error) {
            if (!isAzureNotFoundError(error)) {
              throw error;
            }

            // Outlook may have been changed independently of Sapling. A stale
            // provider reference must not make every later synchronization
            // fail: remove it and recreate the current Sapling event.
            await emFork.remove(reference).flush();
            return await this.createEvent(
              client,
              event,
              emFork,
              classificationMappings,
            );
          }
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
}
