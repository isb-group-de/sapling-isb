import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { REDIS_ENABLED } from '../../constants/project.constants';
import { MessageTemplateService } from '../template/message-template.service';
import { PersonItem } from '../../entity/PersonItem';
import { TeamsDeliveryItem } from '../../entity/TeamsDeliveryItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import type { ClientFormattingContext } from '../common/client-formatting-context.util';
import { TeamsGraphDeliveryService } from './teams-graph-delivery.service';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class TeamsService {
  private readonly graphDeliveryService: TeamsGraphDeliveryService;

  constructor(
    private readonly em: EntityManager,
    private readonly messageTemplateService: MessageTemplateService,
    @InjectQueue('teams') private readonly teamsQueue: Queue,
  ) {
    this.graphDeliveryService = new TeamsGraphDeliveryService(em);
  }

  async querySubscription(
    handle: number,
    payload: object | object[],
    currentUser: PersonItem,
    relationExpressions: string[] = [],
    clientFormattingContext: ClientFormattingContext = {},
    automationContext: JsonRecord = {},
    automationDeduplicationKey?: string,
    canRead?: (recipient: PersonItem) => Promise<boolean>,
    projectContext?: (recipient: PersonItem) => Promise<JsonRecord>,
  ): Promise<TeamsDeliveryItem[]> {
    if (automationDeduplicationKey) {
      const existing = await this.em.findOne(
        TeamsDeliveryItem,
        { automationDeduplicationKey },
        { populate: ['status'] },
      );
      if (existing) {
        if (
          REDIS_ENABLED &&
          existing.handle &&
          existing.status?.handle === 'pending'
        )
          await this.enqueueDelivery(existing.handle, true);
        return [existing];
      }
    }
    const subscription = await this.em.findOne(
      TeamsSubscriptionItem,
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

    if (!entityHandle) {
      throw new Error('global.entityNotFound');
    }

    const template = subscription.template;
    if (
      !template ||
      typeof template !== 'object' ||
      template.isActive === false
    ) {
      throw new Error('global.notActive');
    }

    const sender = await this.resolveSender(currentUser.handle);
    const items = payload instanceof Array ? payload : [payload];
    const deliveries: TeamsDeliveryItem[] = [];

    for (const item of items) {
      const prepared = await this.prepareDelivery({
        subscription,
        item,
        currentUser,
        sender,
        relationExpressions,
        clientFormattingContext,
        automationContext,
        canRead,
        projectContext,
      });

      if (!prepared) continue;

      const delivery = new TeamsDeliveryItem();
      delivery.subscription = subscription;
      delivery.template = template;
      delivery.entity = subscription.entity;
      delivery.createdBy = prepared.createdBy;
      delivery.recipientPerson = prepared.recipientPerson;
      delivery.referenceHandle = prepared.referenceHandle;
      delivery.provider = 'azure';
      delivery.bodyMarkdown = prepared.bodyMarkdown;
      delivery.bodyHtml = prepared.bodyHtml;
      delivery.requestPayload = prepared.requestPayload;
      delivery.attemptCount = 0;
      delivery.automationDeduplicationKey = automationDeduplicationKey;

      if (prepared.failure) {
        delivery.status = await this.graphDeliveryService.ensureStatus(
          this.em,
          'failed',
        );
        delivery.responseStatusCode = prepared.failure.statusCode ?? 400;
        delivery.responseBody = { message: prepared.failure.message };
        delivery.completedAt = new Date();
      } else {
        delivery.status = await this.graphDeliveryService.ensureStatus(
          this.em,
          'pending',
        );
      }

      await this.em.persist(delivery).flush();

      if (!prepared.failure) {
        if (REDIS_ENABLED) {
          await this.enqueueDelivery(
            delivery.handle!,
            Boolean(automationDeduplicationKey),
          );
        } else if (delivery.handle) {
          await this.dispatchDelivery(delivery.handle);
        }
      }

      deliveries.push(delivery);
    }

    return deliveries;
  }

  dispatchDelivery(deliveryId: number): Promise<TeamsDeliveryItem> {
    return this.graphDeliveryService.dispatchDelivery(deliveryId);
  }

  private enqueueDelivery(
    deliveryId: number,
    automation: boolean,
  ): Promise<unknown> {
    const payload = { deliveryId };
    return automation
      ? this.teamsQueue.add('deliver-teams-message', payload, {
          jobId: `automation-teams-${deliveryId}`,
        })
      : this.teamsQueue.add('deliver-teams-message', payload);
  }

  async retryDelivery(handle: number): Promise<TeamsDeliveryItem> {
    const pending = await this.graphDeliveryService.ensureStatus(
      this.em,
      'pending',
    );
    const delivery = await this.em.findOne(TeamsDeliveryItem, { handle });

    if (!delivery) {
      throw new NotFoundException('teams.deliveryNotFound');
    }

    delivery.status = pending;
    delivery.nextRetryAt = undefined;
    delivery.completedAt = undefined;
    delivery.responseStatusCode = undefined;
    delivery.responseBody = undefined;
    delivery.providerMessageId = undefined;

    await this.em.flush();

    if (REDIS_ENABLED) {
      await this.teamsQueue.add('deliver-teams-message', {
        deliveryId: delivery.handle,
      });
    } else if (delivery.handle) {
      await this.dispatchDelivery(delivery.handle);
    }

    return await this.em.findOneOrFail(TeamsDeliveryItem, {
      handle: delivery.handle,
    });
  }

  private async prepareDelivery(options: {
    subscription: TeamsSubscriptionItem;
    item: object;
    currentUser: PersonItem;
    sender: PersonItem | null;
    relationExpressions: string[];
    clientFormattingContext: ClientFormattingContext;
    automationContext?: JsonRecord;
    canRead?: (recipient: PersonItem) => Promise<boolean>;
    projectContext?: (recipient: PersonItem) => Promise<JsonRecord>;
  }): Promise<{
    createdBy: PersonItem;
    recipientPerson?: PersonItem;
    referenceHandle?: string;
    bodyMarkdown: string;
    bodyHtml: string;
    requestPayload: object;
    failure?: { message: string; statusCode?: number };
  } | null> {
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
    const createdBy = options.sender ?? options.currentUser;

    const baseContext =
      !isDeleteSubscription && referenceHandle
        ? await this.messageTemplateService.loadEntityContext(
            entityHandle,
            referenceHandle,
            options.relationExpressions,
          )
        : (options.item as JsonRecord);

    const baseAutomationContext = {
      currentUser: options.currentUser,
      ...baseContext,
      ...(options.automationContext ?? {}),
    };
    const recipientValue = this.messageTemplateService.getContextValue(
      baseAutomationContext,
      options.subscription.recipientField,
    );
    const recipientPerson = await this.resolveRecipient(recipientValue);
    if (
      !options.subscription.notifyActor &&
      recipientPerson?.handle != null &&
      recipientPerson.handle === options.currentUser.handle
    ) {
      return null;
    }
    const projected =
      recipientPerson && options.projectContext
        ? await options.projectContext(recipientPerson)
        : null;
    const projectedTarget = projected?.target;
    const context = projected
      ? {
          currentUser: options.currentUser,
          ...(isRecord(projectedTarget) ? projectedTarget : {}),
          ...projected,
          target: projectedTarget,
        }
      : baseAutomationContext;
    const bodySource = template?.bodyMarkdown ?? '';
    const bodyMarkdown = this.messageTemplateService.replacePlaceholders(
      bodySource,
      context,
      {
        entityHandle,
        locale: options.clientFormattingContext.clientLocale,
        timeZone: options.clientFormattingContext.clientTimeZone,
        currentUser: options.currentUser,
      },
    );
    const bodyHtml = this.messageTemplateService.renderMarkdown(bodyMarkdown);

    if (
      recipientPerson &&
      options.canRead &&
      !(await options.canRead(recipientPerson))
    ) {
      return {
        createdBy,
        recipientPerson,
        referenceHandle,
        bodyMarkdown,
        bodyHtml,
        requestPayload: {
          recipientField: options.subscription.recipientField,
          referenceHandle,
          recipientPersonHandle: recipientPerson.handle,
        },
        failure: { message: 'global.permissionDenied', statusCode: 403 },
      };
    }

    if (!options.sender || options.sender.type?.handle !== 'azure') {
      return {
        createdBy,
        recipientPerson: recipientPerson ?? undefined,
        referenceHandle,
        bodyMarkdown,
        bodyHtml,
        requestPayload: {
          recipientField: options.subscription.recipientField,
          referenceHandle,
        },
        failure: { message: 'teams.senderAzureRequired', statusCode: 400 },
      };
    }

    if (!recipientPerson) {
      return {
        createdBy,
        referenceHandle,
        bodyMarkdown,
        bodyHtml,
        requestPayload: {
          recipientField: options.subscription.recipientField,
          referenceHandle,
        },
        failure: { message: 'teams.recipientNotFound', statusCode: 404 },
      };
    }

    if (
      recipientPerson.type?.handle !== 'azure' ||
      !recipientPerson.loginName?.trim()
    ) {
      return {
        createdBy,
        recipientPerson,
        referenceHandle,
        bodyMarkdown,
        bodyHtml,
        requestPayload: {
          recipientField: options.subscription.recipientField,
          referenceHandle,
          recipientPersonHandle: recipientPerson.handle,
        },
        failure: { message: 'teams.recipientAzureRequired', statusCode: 400 },
      };
    }

    return {
      createdBy,
      recipientPerson,
      referenceHandle,
      bodyMarkdown,
      bodyHtml,
      requestPayload: {
        recipientField: options.subscription.recipientField,
        referenceHandle,
        senderPersonHandle: options.sender.handle,
        senderLoginName: options.sender.loginName,
        recipientPersonHandle: recipientPerson.handle,
        recipientLoginName: recipientPerson.loginName,
      },
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

  private async resolveSender(handle?: number): Promise<PersonItem | null> {
    if (!handle) {
      return null;
    }

    return await this.em.findOne(
      PersonItem,
      { handle },
      { populate: ['session', 'type'] },
    );
  }

  private async resolveRecipient(value: unknown): Promise<PersonItem | null> {
    const handle = this.extractPersonHandle(value);
    if (!handle) {
      return null;
    }

    return await this.em.findOne(
      PersonItem,
      { handle },
      {
        populate: [
          'type',
          'roles',
          'roles.stage',
          'roles.permissions',
          'roles.permissions.entity',
          'roles.permissions.fieldPermissions',
        ],
      },
    );
  }

  private extractPersonHandle(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return Number(value);
    }

    if (isRecord(value)) {
      return this.extractPersonHandle(value.handle);
    }

    return null;
  }
}
