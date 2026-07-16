import { EntityManager } from '@mikro-orm/core';
import { performance } from 'perf_hooks';
import { EntityItem } from '../../entity/EntityItem.js';
import { PersonItem } from '../../entity/PersonItem.js';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem.js';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem.js';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem.js';
import { WebhookService } from '../webhook/webhook.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { InboxService } from '../inbox/inbox.service.js';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { ScriptMethods } from './script.types';

export class ScriptSubscriptionService {
  constructor(
    private readonly em: EntityManager,
    private readonly webhookService: WebhookService,
    private readonly teamsService: TeamsService,
    private readonly inboxService: InboxService,
  ) {}

  public async runSubscription(
    method: ScriptMethods,
    items: object | object[],
    entity: EntityItem,
    user: PersonItem,
    context?: ScriptServerContext,
  ): Promise<boolean> {
    const startTime = performance.now();
    let result: boolean = true;
    try {
      if (method > ScriptMethods.afterRead) {
        const teamsSubscriptions = await this.em.findAll(
          TeamsSubscriptionItem,
          {
            where: {
              entity: { handle: entity.handle },
              type: { handle: ScriptMethods[method] },
              isActive: true,
            },
          },
        );
        const inboxSubscriptions = await this.em.findAll(
          InboxSubscriptionItem,
          {
            where: {
              entity: { handle: entity.handle },
              type: { handle: ScriptMethods[method] },
              isActive: true,
            },
          },
        );
        const subscriptionPayloadItems = Array.isArray(items)
          ? (items as object[])
          : [items];
        await this.populateRecipientRelations(subscriptionPayloadItems, [
          ...teamsSubscriptions.map(
            (subscription) => subscription.recipientField,
          ),
          ...inboxSubscriptions.map(
            (subscription) => subscription.recipientField,
          ),
        ]);

        if (teamsSubscriptions.length > 0) {
          for (const subscription of teamsSubscriptions) {
            if (subscription?.handle) {
              global.log.info(
                `Processing teams subscription: ${subscription.handle}`,
              );
              await this.teamsService.querySubscription(
                subscription.handle,
                subscriptionPayloadItems,
                user,
                [subscription.recipientField],
                {
                  clientLocale: context?.clientLocale,
                  clientTimeZone: context?.clientTimeZone,
                },
              );
            }
          }
        }

        if (inboxSubscriptions.length > 0) {
          for (const subscription of inboxSubscriptions) {
            if (subscription?.handle) {
              global.log.info(
                `Processing inbox subscription: ${subscription.handle}`,
              );
              await this.inboxService.querySubscription(
                subscription.handle,
                subscriptionPayloadItems,
                user,
                [subscription.recipientField],
                {
                  clientLocale: context?.clientLocale,
                  clientTimeZone: context?.clientTimeZone,
                },
              );
            }
          }
        }

        if (teamsSubscriptions.length > 0 || inboxSubscriptions.length > 0) {
          if (user) {
            const executionTime = (performance.now() - startTime) / 1000;
            global.log.debug(
              `execution time: ${executionTime.toFixed(6)}s (script ${ScriptMethods[method]} for entity ${entity.handle})`,
            );
          }
        }
      }
    } catch (e) {
      global.log.error(e);
      result = false;
    }

    return result;
  }

  scheduleWebhookSubscriptions(
    method: ScriptMethods,
    items: object | object[],
    entity: EntityItem,
    user: PersonItem,
  ): void {
    if (method <= ScriptMethods.afterRead) {
      return;
    }

    const snapshot = this.cloneSubscriptionPayload(items);

    this.scheduleBackgroundTask(
      `scriptService - runServer - ${entity.handle} - ${ScriptMethods[method]} - webhook subscription failed`,
      async () => {
        if (
          !(await this.runWebhookSubscriptions(method, snapshot, entity, user))
        ) {
          global.log.warn(
            `scriptService - runServer - ${entity.handle} - ${ScriptMethods[method]} - webhook subscription failed`,
          );
        }
      },
    );
  }

  private async runWebhookSubscriptions(
    method: ScriptMethods,
    items: object | object[],
    entity: EntityItem,
    user: PersonItem,
  ): Promise<boolean> {
    const startTime = performance.now();
    let result = true;

    try {
      const webhookSubscriptions = await this.em.findAll(
        WebhookSubscriptionItem,
        {
          where: {
            entity: { handle: entity.handle },
            type: { handle: ScriptMethods[method] },
            isActive: true,
          },
        },
      );

      if (webhookSubscriptions.length === 0) {
        return true;
      }

      const subscriptionPayloadItems = Array.isArray(items) ? items : [items];

      for (const subscription of webhookSubscriptions) {
        if (subscription?.handle) {
          global.log.info(
            `Processing webhook subscription: ${subscription.handle}`,
          );
          await this.webhookService.querySubscription(
            subscription.handle,
            subscriptionPayloadItems,
          );
        }
      }

      if (user) {
        const executionTime = (performance.now() - startTime) / 1000;
        global.log.debug(
          `execution time: ${executionTime.toFixed(6)}s (webhook subscription ${ScriptMethods[method]} for entity ${entity.handle})`,
        );
      }
    } catch (e) {
      global.log.error(e);
      result = false;
    }

    return result;
  }

  private async populateRecipientRelations(
    items: object[],
    relationExpressions: string[],
  ): Promise<void> {
    const populate = [
      ...new Set(
        relationExpressions.flatMap((expression) =>
          this.expandRelationExpression(expression),
        ),
      ),
    ];

    if (populate.length === 0) {
      return;
    }

    for (const item of items) {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        item.constructor === Object
      ) {
        continue;
      }

      try {
        await this.em.populate(item, populate as never[]);
      } catch (error) {
        global.log.warn(
          `scriptService - populateRecipientRelations failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private cloneSubscriptionPayload<T extends object | object[]>(items: T): T {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(items);
      } catch (error) {
        global.log?.debug?.('scriptService - structuredClone fallback', error);
      }
    }

    if (Array.isArray(items)) {
      const itemArray = items as object[];
      return itemArray.map((item) => this.shallowCloneItem(item)) as T;
    }

    return this.shallowCloneItem(items);
  }

  private shallowCloneItem<T extends object>(item: T): T {
    if (!item || typeof item !== 'object') {
      return item;
    }

    if (Array.isArray(item)) {
      return [...item] as T;
    }

    return { ...(item as Record<string, unknown>) } as T;
  }

  private scheduleBackgroundTask(
    label: string,
    operation: () => Promise<void>,
  ): void {
    setImmediate(() => {
      void operation().catch((error) => {
        global.log?.error?.(label, error);
      });
    });
  }

  private expandRelationExpression(expression: string): string[] {
    const segments = expression
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    return segments.map((_segment, index) =>
      segments.slice(0, index + 1).join('.'),
    );
  }
}
