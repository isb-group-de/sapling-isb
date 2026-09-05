import { EntityManager } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageTemplateService } from '../template/message-template.service';
import { InboxNotificationItem } from '../../entity/InboxNotificationItem';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { PersonItem } from '../../entity/PersonItem';
import { OpenTaskEventsService } from '../current/open-task-events.service';
import type { ClientFormattingContext } from '../common/client-formatting-context.util';
import type { AutomationEventItem } from '../../entity/AutomationEventItem';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class InboxService {
  constructor(
    private readonly em: EntityManager,
    private readonly messageTemplateService: MessageTemplateService,
    private readonly openTaskEventsService: OpenTaskEventsService,
  ) {}

  async querySubscription(
    handle: number,
    payload: object | object[],
    currentUser: PersonItem,
    relationExpressions: string[] = [],
    clientFormattingContext: ClientFormattingContext = {},
  ): Promise<InboxNotificationItem[]> {
    const subscription = await this.em.findOne(
      InboxSubscriptionItem,
      { handle },
      { populate: ['entity', 'type', 'template'] },
    );

    if (!subscription?.isActive) {
      throw new Error('global.notActive');
    }

    const entityHandle =
      typeof subscription.entity === 'object'
        ? subscription.entity.handle
        : undefined;
    const template =
      subscription.template && typeof subscription.template === 'object'
        ? subscription.template
        : null;

    if (!entityHandle) {
      throw new Error('global.entityNotFound');
    }

    if (!template || template.isActive === false) {
      throw new Error('global.notActive');
    }

    const items = Array.isArray(payload) ? (payload as object[]) : [payload];
    const notifications: InboxNotificationItem[] = [];
    const affectedUserHandles = new Set<number>();

    for (const item of items) {
      const prepared = await this.prepareNotifications({
        subscription,
        item,
        currentUser,
        relationExpressions,
        clientFormattingContext,
      });

      for (const recipient of prepared.recipients) {
        if (
          !subscription.notifyActor &&
          recipient.handle === currentUser.handle
        ) {
          continue;
        }

        if (typeof recipient.handle === 'number') {
          affectedUserHandles.add(recipient.handle);
        }

        const notification = this.em.create(InboxNotificationItem, {
          subscription,
          template,
          entity: subscription.entity,
          createdBy: currentUser.handle,
          recipientPerson: recipient.handle,
          referenceHandle: prepared.referenceHandle,
          title: prepared.title,
          bodyMarkdown: prepared.bodyMarkdown,
          bodyText: prepared.bodyText,
          requestPayload: {
            recipientField: subscription.recipientField,
            referenceHandle: prepared.referenceHandle,
            recipientPersonHandle: recipient.handle,
          },
          isRead: false,
        } as never);

        notifications.push(notification);
      }
    }

    if (notifications.length > 0) {
      await this.em.flush();
      this.openTaskEventsService.notifyUsers(affectedUserHandles);
    }

    return notifications;
  }

  async queryAutomationSubscription(
    subscription: InboxSubscriptionItem,
    target: JsonRecord,
    event: AutomationEventItem,
    deduplicationKey: string,
    canRead: (recipient: PersonItem) => Promise<boolean> = () =>
      Promise.resolve(true),
    projectContext: (
      recipient: PersonItem,
    ) => Promise<Record<string, unknown>> = () => Promise.resolve({}),
  ): Promise<InboxNotificationItem[]> {
    const template = subscription.template;
    if (!subscription.isActive || !template.isActive) return [];
    const context = {
      ...target,
      target,
      source: event.newSnapshot ?? event.oldSnapshot ?? {},
      oldSource: event.oldSnapshot ?? {},
      newSource: event.newSnapshot ?? {},
      currentUser: event.actor,
      event: { operation: event.operation, context: event.context ?? {} },
    };
    const recipients = await this.resolveRecipients(
      this.messageTemplateService.getContextValue(
        context,
        subscription.recipientField,
      ),
    );
    const notifications: InboxNotificationItem[] = [];
    const affected = new Set<number>();
    for (const recipient of recipients) {
      if (
        recipient.handle == null ||
        (!subscription.notifyActor && recipient.handle === event.actor?.handle)
      )
        continue;
      if (!(await canRead(recipient))) continue;
      const recipientDeduplicationKey = `${deduplicationKey}:${recipient.handle}`;
      const existing = await this.em.findOne(InboxNotificationItem, {
        automationDeduplicationKey: recipientDeduplicationKey,
      });
      if (existing) {
        notifications.push(existing);
        continue;
      }
      const projected = await projectContext(recipient);
      const projectedTarget = projected.target ?? target;
      const recipientContext = {
        ...(projectedTarget as JsonRecord),
        target: projectedTarget,
        source: projected.source ?? context.source,
        oldSource: projected.oldSource ?? context.oldSource,
        newSource: projected.newSource ?? context.newSource,
        currentUser: event.actor,
        event: context.event,
      };
      affected.add(recipient.handle);
      const title = this.messageTemplateService.replacePlaceholders(
        template.titleTemplate ?? template.name ?? '',
        recipientContext,
        { entityHandle: subscription.entity.handle, currentUser: event.actor },
      );
      const bodyMarkdown = this.messageTemplateService.replacePlaceholders(
        template.bodyMarkdown ?? '',
        recipientContext,
        { entityHandle: subscription.entity.handle, currentUser: event.actor },
      );
      notifications.push(
        this.em.create(InboxNotificationItem, {
          subscription,
          template,
          entity: subscription.entity,
          createdBy: event.actor,
          recipientPerson: recipient,
          referenceHandle:
            typeof target.handle === 'string' ||
            typeof target.handle === 'number'
              ? String(target.handle)
              : '',
          title,
          bodyMarkdown,
          bodyText: this.messageTemplateService.stripMarkdown(bodyMarkdown),
          requestPayload: {
            automationEventId: event.eventId,
            recipientField: subscription.recipientField,
          },
          automationDeduplicationKey: recipientDeduplicationKey,
          isRead: false,
        } as never),
      );
    }
    if (notifications.length) {
      this.em.persist(notifications);
      await this.em.flush();
      this.openTaskEventsService.notifyUsers(affected);
    }
    return notifications;
  }

  async getUnreadNotifications(
    user: Pick<PersonItem, 'handle'>,
  ): Promise<InboxNotificationItem[]> {
    if (user.handle == null) {
      return [];
    }

    return this.em.find(
      InboxNotificationItem,
      {
        recipientPerson: { handle: user.handle },
        isRead: false,
      },
      {
        populate: [
          'entity',
          'subscription',
          'template',
          'createdBy',
          'recipientPerson',
        ],
        orderBy: { createdAt: 'DESC', handle: 'DESC' },
      },
    );
  }

  async markNotificationRead(
    handle: number,
    user: Pick<PersonItem, 'handle'>,
  ): Promise<InboxNotificationItem> {
    const notification = await this.em.findOne(
      InboxNotificationItem,
      {
        handle,
        recipientPerson: { handle: user.handle },
      },
      {
        populate: [
          'entity',
          'subscription',
          'template',
          'createdBy',
          'recipientPerson',
        ],
      },
    );

    if (!notification) {
      throw new NotFoundException('global.entityNotFound');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await this.em.flush();
    this.openTaskEventsService.notifyUsers([user.handle]);
    return notification;
  }

  private async prepareNotifications(options: {
    subscription: InboxSubscriptionItem;
    item: object;
    currentUser: PersonItem;
    relationExpressions: string[];
    clientFormattingContext: ClientFormattingContext;
  }): Promise<{
    recipients: PersonItem[];
    referenceHandle?: string;
    title: string;
    bodyMarkdown: string;
    bodyText: string;
  }> {
    const entityHandle =
      typeof options.subscription.entity === 'object'
        ? options.subscription.entity.handle
        : '';
    const template =
      typeof options.subscription.template === 'object'
        ? options.subscription.template
        : null;
    const referenceHandle = this.extractReferenceHandle(options.item);
    const isDeleteSubscription =
      options.subscription.type?.handle === 'afterDelete';

    const baseContext =
      !isDeleteSubscription && referenceHandle
        ? await this.messageTemplateService.loadEntityContext(
            entityHandle,
            referenceHandle,
            options.relationExpressions,
          )
        : (options.item as JsonRecord);

    const context = {
      currentUser: options.currentUser,
      ...baseContext,
    };
    const recipientValue = this.messageTemplateService.getContextValue(
      context,
      options.subscription.recipientField,
    );
    const recipients = await this.resolveRecipients(recipientValue);
    const title = this.messageTemplateService.replacePlaceholders(
      template?.titleTemplate ?? template?.name ?? '',
      context,
      {
        entityHandle,
        locale: options.clientFormattingContext.clientLocale,
        timeZone: options.clientFormattingContext.clientTimeZone,
        currentUser: options.currentUser,
      },
    );
    const bodyMarkdown = this.messageTemplateService.replacePlaceholders(
      template?.bodyMarkdown ?? '',
      context,
      {
        entityHandle,
        locale: options.clientFormattingContext.clientLocale,
        timeZone: options.clientFormattingContext.clientTimeZone,
        currentUser: options.currentUser,
      },
    );

    return {
      recipients,
      referenceHandle,
      title,
      bodyMarkdown,
      bodyText: this.messageTemplateService.stripMarkdown(bodyMarkdown),
    };
  }

  private extractReferenceHandle(item: object): string | undefined {
    if (!isRecord(item)) {
      return undefined;
    }

    const value = item.handle;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    return undefined;
  }

  private async resolveRecipients(value: unknown): Promise<PersonItem[]> {
    const handles = [...new Set(this.extractPersonHandles(value))];
    if (handles.length === 0) {
      return [];
    }

    return this.em.find(
      PersonItem,
      { handle: { $in: handles } },
      {
        populate: [
          'roles',
          'roles.stage',
          'roles.permissions',
          'roles.permissions.entity',
          'roles.permissions.fieldPermissions',
        ],
      },
    );
  }

  private extractPersonHandles(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.extractPersonHandles(entry));
    }

    if (typeof value === 'number' && Number.isInteger(value)) {
      return [value];
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return [Number(value)];
    }

    if (isRecord(value)) {
      return this.extractPersonHandles(value.handle);
    }

    return [];
  }
}
