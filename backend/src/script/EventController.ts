import { GoogleCalendarService } from '../calendar/google/google.calendar.service';
import { AzureCalendarService } from '../calendar/azure/azure.calendar.service';
import type { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../entity/EntityItem.js';
import { PersonItem } from '../entity/PersonItem.js';
import { ScriptClass } from './core/script.class.js';
import { ScriptResultServer } from './core/script.result.server.js';
import { EventItem } from '../entity/EventItem.js';
import type { ScriptServerContext } from './core/script.interface.js';

const CALENDAR_PROVIDER_RELEVANT_EVENT_FIELDS = new Set([
  'title',
  'description',
  'startDate',
  'endDate',
  'recurrenceRule',
  'participants',
  'type',
  'category',
  'status',
]);

/**
 * Controller for Note entity scripts.
 * Extends the ScriptClass to provide custom logic for Note operations.
 */
export class EventController extends ScriptClass {
  /**
   * Creates a new instance of NoteController.
   *
   * @param {EntityItem} entity - The entity associated with the script.
   * @param {PersonItem} user - The user executing the script.
   */
  constructor(
    entity: EntityItem,
    user: PersonItem,
    em: EntityManager,
    azureCalendarService: AzureCalendarService,
    googleCalendarService: GoogleCalendarService,
  ) {
    super(entity, user, em, azureCalendarService, googleCalendarService);
  }

  /**
   * Event triggered after Event records are created.
   * Sets the person property of each Event to the current user's handle.
   *
   * @param {EventItem[]} items - The new Event records to be inserted.
   * @returns {Promise<ScriptResultServer>} The result of the before insert event.
   */
  async afterInsert(
    items: EventItem[],
    context?: ScriptServerContext,
  ): Promise<ScriptResultServer> {
    this.logDebug('afterInsert', 'Handling event insert hook', {
      itemCount: items.length,
    });
    return this.sendEvent('afterInsert', items, context);
  }

  /**
   * Event triggered after Event records are updated.
   * Sets the person property of each Event to the current user's handle.
   *
   * @param {EventItem[]} items - The new Event records to be inserted.
   * @returns {Promise<ScriptResultServer>} The result of the before insert event.
   */
  async afterUpdate(
    items: EventItem[],
    context?: ScriptServerContext,
  ): Promise<ScriptResultServer> {
    this.logDebug('afterUpdate', 'Handling event update hook', {
      itemCount: items.length,
    });
    return this.sendEvent('afterUpdate', items, context);
  }

  /**
   * Sends event data to the appropriate calendar service based on user type.
   * @param {EventItem[]} items - The new Event records to be inserted.
   * @returns {Promise<ScriptResultServer>} The result of the before insert event.
   */
  private async sendEvent(
    operation: 'afterInsert' | 'afterUpdate',
    items: EventItem[],
    context?: ScriptServerContext,
  ): Promise<ScriptResultServer> {
    this.logDebug(operation, 'Starting calendar synchronization', {
      itemCount: items.length,
      provider: this.user.type?.handle,
      hasSession: Boolean(this.user.session),
    });

    if (items && items.length > 0) {
      switch (this.user.type?.handle) {
        case 'azure': {
          if (this.azureCalendarService && this.user.session) {
            for (const event of items) {
              this.logInfo(operation, 'Queueing Azure calendar event', {
                eventHandle: event.handle,
              });
              await this.queueCalendarEvent(operation, 'azure', event, context);
              this.logDebug(operation, 'Azure calendar event queued', {
                eventHandle: event.handle,
              });
            }
          } else {
            this.logWarn(
              operation,
              'Skipping Azure calendar synchronization due to missing dependencies',
              {
                hasCalendarService: Boolean(this.azureCalendarService),
                hasSession: Boolean(this.user.session),
              },
            );
          }
          break;
        }
        case 'google': {
          if (this.googleCalendarService && this.user.session) {
            for (const event of items) {
              this.logInfo(operation, 'Queueing Google calendar event', {
                eventHandle: event.handle,
              });
              await this.queueCalendarEvent(
                operation,
                'google',
                event,
                context,
              );
              this.logDebug(operation, 'Google calendar event queued', {
                eventHandle: event.handle,
              });
            }
          } else {
            this.logWarn(
              operation,
              'Skipping Google calendar synchronization due to missing dependencies',
              {
                hasCalendarService: Boolean(this.googleCalendarService),
                hasSession: Boolean(this.user.session),
              },
            );
          }
          break;
        }
        default: {
          this.logDebug(
            operation,
            'No matching calendar provider configured, skipping synchronization',
            {
              provider: this.user.type?.handle ?? 'unknown',
            },
          );
        }
      }
    } else {
      this.logTrace(operation, 'No events received for synchronization');
    }

    this.logDebug(operation, 'Calendar synchronization completed', {
      itemCount: items.length,
    });
    return new ScriptResultServer(items);
  }

  private async queueCalendarEvent(
    operation: 'afterInsert' | 'afterUpdate',
    provider: 'azure' | 'google',
    event: EventItem,
    context?: ScriptServerContext,
  ): Promise<void> {
    const changedFields =
      context?.changedFields ??
      (context?.referenceName ? [context.referenceName] : undefined);

    if (
      operation === 'afterUpdate' &&
      !context?.calendarDeliveryOperation &&
      changedFields &&
      !changedFields.some((field) =>
        CALENDAR_PROVIDER_RELEVANT_EVENT_FIELDS.has(field),
      )
    ) {
      this.logDebug(operation, 'Skipping internal-only calendar update', {
        eventHandle: event.handle,
        changedFields,
      });
      return;
    }

    const queueEvent = async () => {
      let persistedEvent = event;

      if (context?.postCommitTasks) {
        if (typeof event.handle !== 'number') {
          throw new Error('calendar.eventHandleRequired');
        }
        if (!this.em) {
          throw new Error('calendar.entityManagerRequired');
        }

        const reloadedEvent = await this.em.findOne(
          EventItem,
          { handle: event.handle },
          { populate: ['type'] },
        );
        if (!reloadedEvent) {
          throw new Error('calendar.eventNotFound');
        }
        persistedEvent = reloadedEvent;
      }

      const calendarService =
        provider === 'azure'
          ? this.azureCalendarService
          : this.googleCalendarService;
      if (!calendarService || !this.user.session) {
        throw new Error('calendar.serviceOrSessionRequired');
      }

      if (context?.calendarDeliveryOperation) {
        if (changedFields) {
          await calendarService.queueEvent(
            persistedEvent,
            this.user.session,
            context.calendarDeliveryOperation,
            changedFields,
          );
        } else {
          await calendarService.queueEvent(
            persistedEvent,
            this.user.session,
            context.calendarDeliveryOperation,
          );
        }
      } else if (changedFields) {
        await calendarService.queueEvent(
          persistedEvent,
          this.user.session,
          undefined,
          changedFields,
        );
      } else {
        await calendarService.queueEvent(persistedEvent, this.user.session);
      }
    };

    if (context?.postCommitTasks) {
      context.postCommitTasks.push({
        label: `calendarDelivery:${operation}:${event.handle ?? 'unknown'}`,
        operation: queueEvent,
      });
      return;
    }

    await queueEvent();
  }
}
