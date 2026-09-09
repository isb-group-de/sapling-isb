import { EntityManager } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { WebhookDeliveryItem } from '../../entity/WebhookDeliveryItem';
import { WebhookDeliveryStatusItem } from '../../entity/WebhookDeliveryStatusItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { REDIS_ENABLED } from '../../constants/project.constants';
import { WebhookDeliveryExecutor } from './webhook-delivery.executor';
import { WebhookPayloadSanitizerService } from './webhook-payload-sanitizer.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    @InjectQueue('webhooks') private readonly webhookQueue: Queue,
    private readonly webhookDeliveryExecutor: WebhookDeliveryExecutor,
    private readonly payloadSanitizer: WebhookPayloadSanitizerService = new WebhookPayloadSanitizerService(
      templateService,
    ),
  ) {}

  async querySubscription(
    handle: number,
    payload: object,
    automationContext?: object,
    automationDeduplicationKey?: string,
  ): Promise<WebhookDeliveryItem> {
    if (automationDeduplicationKey) {
      const existing = await this.em.findOne(
        WebhookDeliveryItem,
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
        return existing;
      }
    }
    const subscription = await this.em.findOne(
      WebhookSubscriptionItem,
      { handle },
      { populate: ['entity'] },
    );
    const pending = await this.em.findOne(WebhookDeliveryStatusItem, {
      handle: 'pending',
    });

    if (!subscription?.isActive) {
      throw new Error('global.notActive');
    }

    if (!pending) {
      throw new Error('global.notFound');
    }

    const prepared = await this.preparePayload(subscription, payload);
    const preparedPayload =
      automationContext && prepared && typeof prepared === 'object'
        ? {
            ...(prepared as Record<string, unknown>),
            automation: automationContext,
          }
        : prepared;

    const delivery = new WebhookDeliveryItem();
    delivery.subscription = subscription;
    delivery.payload = preparedPayload;
    delivery.status = pending;
    delivery.automationDeduplicationKey = automationDeduplicationKey;

    await this.em.persist(delivery).flush();

    if (REDIS_ENABLED) {
      await this.enqueueDelivery(
        delivery.handle!,
        Boolean(automationDeduplicationKey),
      );
      return delivery;
    }

    if (typeof delivery.handle === 'number') {
      await this.webhookDeliveryExecutor.execute(delivery.handle, 1);
      return await this.em.findOneOrFail(WebhookDeliveryItem, {
        handle: delivery.handle,
      });
    }

    return delivery;
  }

  async retryDelivery(handle: number): Promise<WebhookDeliveryItem> {
    const pending = await this.em.findOne(WebhookDeliveryStatusItem, {
      handle: 'pending',
    });

    const delivery = await this.em.findOne(WebhookDeliveryItem, { handle });

    if (!delivery || !pending) {
      throw new Error('global.notFound');
    }

    delivery.status = pending;
    delivery.nextRetryAt = undefined;

    await this.em.flush();

    if (REDIS_ENABLED) {
      await this.webhookQueue.add('deliver-webhook', {
        deliveryId: delivery.handle,
      });
      return delivery;
    }

    if (typeof delivery.handle === 'number') {
      await this.webhookDeliveryExecutor.execute(delivery.handle, 1);
    }

    return delivery;
  }

  private enqueueDelivery(
    deliveryId: number,
    automation: boolean,
  ): Promise<unknown> {
    const payload = { deliveryId };
    return automation
      ? this.webhookQueue.add('deliver-webhook', payload, {
          jobId: `automation-webhook-${deliveryId}`,
        })
      : this.webhookQueue.add('deliver-webhook', payload);
  }

  private async preparePayload(
    subscription: WebhookSubscriptionItem,
    payload: object,
  ): Promise<object> {
    const entityHandle =
      typeof subscription.entity === 'object'
        ? subscription.entity.handle
        : null;

    if (!entityHandle) {
      return payload;
    }

    const template = this.templateService.getEntityTemplate(entityHandle);
    const normalizedRelations = this.normalizeRelations(subscription.relations);

    if (normalizedRelations.length === 0) {
      return this.payloadSanitizer.sanitizeEntityResult(
        entityHandle,
        payload,
        template,
      );
    }

    const populate = this.buildPopulate(normalizedRelations, template);

    if (populate.length === 0) {
      return this.payloadSanitizer.sanitizeEntityResult(
        entityHandle,
        payload,
        template,
      );
    }

    const isDeleteSubscription = subscription.type?.handle === 'afterDelete';

    if (Array.isArray(payload)) {
      const preparedItems = await Promise.all(
        payload.map((item) =>
          this.preparePayloadItem(
            entityHandle,
            item,
            populate,
            isDeleteSubscription,
          ),
        ),
      );

      return this.payloadSanitizer.sanitizeEntityResult(
        entityHandle,
        preparedItems,
        template,
      );
    }

    const preparedItem = await this.preparePayloadItem(
      entityHandle,
      payload,
      populate,
      isDeleteSubscription,
    );

    return this.payloadSanitizer.sanitizeEntityResult(
      entityHandle,
      preparedItem as object,
      template,
    );
  }

  private async preparePayloadItem(
    entityHandle: string,
    item: unknown,
    populate: string[],
    isDeleteSubscription: boolean,
  ): Promise<unknown> {
    if (!this.isPlainRecord(item)) {
      return item;
    }

    const isEntityInstance = item.constructor !== Object;

    if (isEntityInstance) {
      try {
        await this.em.populate(item, populate as never[]);
      } catch (error) {
        global.log.warn(
          `webhookService - populate failed for ${entityHandle}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      return item;
    }

    if (isDeleteSubscription) {
      return item;
    }

    const handle = this.payloadSanitizer.extractHandleValue(item);

    if (
      handle == null ||
      (typeof handle !== 'string' && typeof handle !== 'number')
    ) {
      return item;
    }

    try {
      const entityClass = ENTITY_MAP[entityHandle] as
        { prototype?: object } | undefined;

      if (!entityClass) {
        return item;
      }

      const reloadedItem = await this.em.findOne(
        entityClass as never,
        this.getHandleFilter(entityHandle, handle),
        { populate: populate as never[] },
      );

      return reloadedItem ?? item;
    } catch (error) {
      global.log.warn(
        `webhookService - reload failed for ${entityHandle}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return item;
    }
  }

  private normalizeRelations(relations?: string[] | null): string[] {
    if (!Array.isArray(relations)) {
      return [];
    }

    return relations
      .filter((relation): relation is string => typeof relation === 'string')
      .map((relation) => relation.trim())
      .filter(Boolean);
  }

  private getHandleFilter(
    entityHandle: string,
    handle: string | number,
  ): { handle: string | number } {
    return { handle: this.normalizeHandleValue(entityHandle, handle) };
  }

  private normalizeHandleValue(
    entityHandle: string,
    handle: string | number,
  ): string | number {
    const handleField = this.templateService
      .getEntityTemplate(entityHandle)
      .find((field) => field.name === 'handle');

    if (
      handleField?.type === 'number' &&
      typeof handle === 'string' &&
      handle.trim().length > 0
    ) {
      const parsedHandle = Number(handle);

      if (!Number.isNaN(parsedHandle)) {
        return parsedHandle;
      }
    }

    return handle;
  }

  private buildPopulate(
    relations: string[],
    template: EntityTemplateDto[],
  ): string[] {
    const populate: string[] = [];

    if (relations.includes('*')) {
      const refs: string[] = template
        .filter((x) => !!x.isReference)
        .map((x) => x.name);
      populate.push(...refs);
    } else {
      if (relations.includes('1:m')) {
        const refs: string[] = template
          .filter((x) => !!x.isReference && x.kind === '1:m')
          .map((x) => x.name);
        populate.push(...refs);
      }
      if (relations.includes('m:1')) {
        const refs: string[] = template
          .filter((x) => !!x.isReference && x.kind === 'm:1')
          .map((x) => x.name);
        populate.push(...refs);
      }
      if (relations.includes('m:n')) {
        const refs: string[] = template
          .filter((x) => !!x.isReference && x.kind === 'm:n')
          .map((x) => x.name);
        populate.push(...refs);
      }
      if (relations.includes('n:m')) {
        const refs: string[] = template
          .filter((x) => !!x.isReference && x.kind === 'n:m')
          .map((x) => x.name);
        populate.push(...refs);
      }
      const namedRefs: string[] = relations.filter((relation) => {
        return template.some((field) => {
          return (
            !!field.isReference &&
            (relation === field.name || relation.startsWith(`${field.name}.`))
          );
        });
      });
      populate.push(...namedRefs);
    }

    return [...new Set(populate)];
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
