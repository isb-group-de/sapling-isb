import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager } from '@mikro-orm/core';
import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  AutomationEventItem,
  type AutomationOperation,
} from '../../entity/AutomationEventItem';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { REDIS_ENABLED } from '../../constants/project.constants';

type ChainContext = { chainId: string; depth: number };
const EXCLUDED = new Set([
  'automationEvent',
  'automationExecution',
  'fieldAutomation',
  'inboxSubscription',
  'teamsSubscription',
  'webhookSubscription',
  'inboxTemplate',
  'inboxNotification',
]);

@Injectable()
export class AutomationEventService implements OnModuleInit {
  private readonly chain = new AsyncLocalStorage<ChainContext>();
  private processor?: () => Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly em: EntityManager,
    @Optional() @InjectQueue('automations') private readonly queue?: Queue,
  ) {}

  onModuleInit(): void {
    if (REDIS_ENABLED && this.queue) {
      void this.queue
        .setGlobalConcurrency(1)
        .catch((error) => global.log?.error?.('automation queue', error));
    }
    this.timer = setInterval(() => this.wake(), 30_000);
    this.timer.unref();
  }

  registerProcessor(processor: () => Promise<void>): void {
    this.processor = processor;
    this.wake();
  }

  async record(options: {
    entityHandle: string;
    sourceHandle: string | number | null | undefined;
    operation: AutomationOperation;
    actor: PersonItem;
    oldSnapshot?: Record<string, unknown> | null;
    newSnapshot?: Record<string, unknown> | null;
    context?: Record<string, unknown>;
  }): Promise<AutomationEventItem | null> {
    if (
      EXCLUDED.has(options.entityHandle) ||
      options.sourceHandle == null ||
      options.actor?.handle == null
    )
      return null;
    const sourceEntity = await this.em.findOne(EntityItem, {
      handle: options.entityHandle,
    });
    if (!sourceEntity) return null;
    const current = this.chain.getStore();
    const event = this.em.create(AutomationEventItem, {
      sourceEntity,
      sourceHandle: String(options.sourceHandle),
      operation: options.operation,
      // Request principals belong to a separate read context. Attaching the
      // instance would cascade its in-memory changes into this write.
      actor: options.actor.handle,
      chainId: current?.chainId,
      chainDepth: current ? current.depth + 1 : 0,
      oldSnapshot: this.jsonSafe(options.oldSnapshot),
      newSnapshot: this.jsonSafe(options.newSnapshot),
      context: this.jsonSafe(options.context),
    } as never);
    this.em.persist(event);
    await this.em.flush();
    this.wake();
    return event;
  }

  runInChain<T>(
    event: AutomationEventItem,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.chain.run(
      { chainId: event.chainId, depth: event.chainDepth },
      operation,
    );
  }

  private wake(): void {
    if (!this.processor) return;
    if (REDIS_ENABLED && this.queue) {
      void this.queue
        .add('process-automation-events', {})
        .catch((error) => global.log?.error?.('automation queue', error));
      return;
    }
    setImmediate(
      () =>
        void this.processor?.().catch((error) =>
          global.log?.error?.('automation processor', error),
        ),
    );
  }

  private jsonSafe(
    value: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null | undefined {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
