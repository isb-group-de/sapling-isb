import { EntityManager, type EntityClass } from '@mikro-orm/core';
import { HttpException, Injectable, OnModuleInit } from '@nestjs/common';
import { AutomationEventItem } from '../../entity/AutomationEventItem';
import { AutomationExecutionItem } from '../../entity/AutomationExecutionItem';
import { FieldAutomationItem } from '../../entity/FieldAutomationItem';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { GenericService } from '../generic/generic.service';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import { GenericPermissionService } from '../generic/generic-permission.service';
import { GenericSanitizerService } from '../generic/generic-sanitizer.service';
import { FieldPermissionService } from '../current/field-permission.service';
import { InboxService } from '../inbox/inbox.service';
import { TeamsService } from '../teams/teams.service';
import { WebhookService } from '../webhook/webhook.service';
import { AutomationConditionService } from './automation-condition.service';
import { AutomationEventService } from './automation-event.service';
import { AutomationReferenceResolverService } from './automation-reference-resolver.service';

@Injectable()
export class AutomationProcessorService implements OnModuleInit {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly RETRY_DELAY_MS = 30_000;
  private running = false;
  constructor(
    private readonly em: EntityManager,
    private readonly events: AutomationEventService,
    private readonly paths: AutomationReferenceResolverService,
    private readonly conditions: AutomationConditionService,
    private readonly generic: GenericService,
    private readonly permissions: GenericPermissionService,
    private readonly fieldPermissions: FieldPermissionService,
    private readonly sanitizer: GenericSanitizerService,
    private readonly customFields: GenericCustomFieldService,
    private readonly inbox: InboxService,
    private readonly teams: TeamsService,
    private readonly webhooks: WebhookService,
  ) {}

  onModuleInit(): void {
    this.events.registerProcessor(() => this.processPending());
  }

  async processPending(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.recoverInterruptedEvents();
      for (;;) {
        const event = await this.em.findOne(
          AutomationEventItem,
          {
            status: 'pending',
            $or: [
              { nextAttemptAt: null },
              { nextAttemptAt: { $lte: new Date() } },
            ],
          },
          {
            populate: [
              'sourceEntity',
              'actor',
              'actor.roles',
              'actor.roles.stage',
              'actor.roles.permissions',
              'actor.roles.permissions.entity',
              'actor.roles.permissions.fieldPermissions',
            ],
            orderBy: { handle: 'ASC' },
          },
        );
        if (!event) break;
        const attemptCount = event.attemptCount + 1;
        const claimed = await this.em.nativeUpdate(
          AutomationEventItem,
          { handle: event.handle, status: 'pending' },
          {
            status: 'processing',
            attemptCount,
            processingStartedAt: new Date(),
          },
        );
        if (!claimed) continue;
        try {
          if (event.chainDepth >= 32)
            throw new Error('automation.chainDepthExceeded');
          await this.processEvent(event);
          await this.em.nativeUpdate(
            AutomationEventItem,
            { handle: event.handle, status: 'processing' },
            {
              status: 'completed',
              completedAt: new Date(),
              error: null,
              nextAttemptAt: null,
              processingStartedAt: null,
            },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const status =
            attemptCount >= AutomationProcessorService.MAX_ATTEMPTS
              ? 'failed'
              : 'pending';
          const nextAttemptAt =
            status === 'pending'
              ? new Date(
                  Date.now() +
                    AutomationProcessorService.RETRY_DELAY_MS *
                      2 ** (attemptCount - 1),
                )
              : null;
          await this.em.nativeUpdate(
            AutomationEventItem,
            { handle: event.handle, status: 'processing' },
            {
              status,
              error: message,
              nextAttemptAt,
              processingStartedAt: null,
            },
          );
          global.log?.error?.(`Automation event ${event.eventId}: ${message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async recoverInterruptedEvents(): Promise<void> {
    const staleBefore = new Date(Date.now() - 15 * 60_000);
    await this.em.nativeUpdate(
      AutomationEventItem,
      {
        status: 'processing',
        $or: [
          { processingStartedAt: null },
          { processingStartedAt: { $lte: staleBefore } },
        ],
      },
      {
        status: 'pending',
        nextAttemptAt: null,
        processingStartedAt: null,
      },
    );
  }

  private async processEvent(event: AutomationEventItem): Promise<void> {
    const source = event.sourceEntity.handle;
    const inboxRules = await this.em.find(
      InboxSubscriptionItem,
      {
        isActive: true,
        sourceEntity: { handle: source },
        type: { handle: event.operation },
      },
      {
        populate: ['sourceEntity', 'entity', 'template', 'type'],
        orderBy: { priority: 'DESC', handle: 'ASC' },
      },
    );
    const fieldRules = await this.em.find(
      FieldAutomationItem,
      {
        isActive: true,
        sourceEntity: { handle: source },
        operation: { handle: event.operation },
      },
      {
        populate: ['sourceEntity', 'targetEntity', 'operation'],
        orderBy: { priority: 'DESC', handle: 'ASC' },
      },
    );
    const teamsRules = await this.em.find(
      TeamsSubscriptionItem,
      {
        isActive: true,
        sourceEntity: { handle: source },
        type: { handle: event.operation },
      },
      {
        populate: ['sourceEntity', 'entity', 'template', 'type'],
        orderBy: { priority: 'DESC', handle: 'ASC' },
      },
    );
    const webhookRules = await this.em.find(
      WebhookSubscriptionItem,
      {
        isActive: true,
        sourceEntity: { handle: source },
        type: { handle: event.operation },
      },
      {
        populate: ['sourceEntity', 'entity', 'type'],
        orderBy: { priority: 'DESC', handle: 'ASC' },
      },
    );
    const claimedFields = new Map<string, number>();
    for (const rule of inboxRules) await this.processInboxRule(event, rule);
    for (const rule of teamsRules)
      await this.processDeliveryRule(event, rule, 'teams');
    for (const rule of webhookRules)
      await this.processDeliveryRule(event, rule, 'webhook');
    for (const rule of fieldRules)
      await this.processFieldRule(event, rule, claimedFields);
  }

  private async processDeliveryRule(
    event: AutomationEventItem,
    rule: TeamsSubscriptionItem | WebhookSubscriptionItem,
    action: 'teams' | 'webhook',
  ): Promise<void> {
    const targetEntity = rule.entity.handle;
    const handles = await this.resolveTargets(
      event,
      targetEntity,
      rule.referencePath,
    );
    for (const handle of handles) {
      const target = await this.loadTargetForEvent(event, targetEntity, handle);
      if (
        !target ||
        !this.conditions.matches(
          rule.conditions,
          event.oldSnapshot,
          event.newSnapshot,
          target,
        )
      )
        continue;
      const key = `${event.eventId}:${action}:${rule.handle}:${targetEntity}:${handle}`;
      if (await this.exists(key)) continue;
      const automationContext = {
        source: event.newSnapshot ?? event.oldSnapshot ?? {},
        oldSource: event.oldSnapshot ?? {},
        newSource: event.newSnapshot ?? {},
        event: { operation: event.operation, context: event.context ?? {} },
      };
      try {
        if (action === 'teams')
          await this.teams.querySubscription(
            rule.handle!,
            target,
            event.actor,
            this.paths.population(targetEntity),
            {},
            { ...automationContext, target },
            key,
            (recipient) =>
              this.canRecipientRead(
                targetEntity,
                handle,
                recipient,
                event.operation === 'afterDelete' &&
                  event.sourceEntity.handle === targetEntity &&
                  event.sourceHandle === handle,
              ),
            (recipient) =>
              this.projectRecipientContext(
                event,
                targetEntity,
                target,
                recipient,
              ),
          );
        else
          await this.webhooks.querySubscription(
            rule.handle!,
            target,
            automationContext,
            key,
          );
        await this.log(
          event,
          key,
          action,
          String(rule.handle),
          targetEntity,
          handle,
          'completed',
        );
      } catch (error) {
        if (!this.isTerminalActionError(error)) throw error;
        await this.log(
          event,
          key,
          action,
          String(rule.handle),
          targetEntity,
          handle,
          'failed',
          this.message(error),
        );
      }
    }
  }

  private async processInboxRule(
    event: AutomationEventItem,
    rule: InboxSubscriptionItem,
  ): Promise<void> {
    const targetEntity = rule.entity.handle;
    const handles = await this.resolveTargets(
      event,
      targetEntity,
      rule.referencePath,
    );
    for (const handle of handles) {
      const target = await this.loadTargetForEvent(event, targetEntity, handle);
      if (
        !target ||
        !this.conditions.matches(
          rule.conditions,
          event.oldSnapshot,
          event.newSnapshot,
          target,
        )
      )
        continue;
      const key = `${event.eventId}:inbox:${rule.handle}:${targetEntity}:${handle}`;
      if (await this.exists(key)) continue;
      try {
        await this.runAtomic(async () => {
          await this.inbox.queryAutomationSubscription(
            rule,
            target,
            event,
            key,
            (recipient) =>
              this.canRecipientRead(
                targetEntity,
                handle,
                recipient,
                event.operation === 'afterDelete' &&
                  event.sourceEntity.handle === targetEntity &&
                  event.sourceHandle === handle,
              ),
            (recipient) =>
              this.projectRecipientContext(
                event,
                targetEntity,
                target,
                recipient,
              ),
          );
          await this.log(
            event,
            key,
            'inbox',
            String(rule.handle),
            targetEntity,
            handle,
            'completed',
          );
        });
      } catch (error) {
        if (!this.isTerminalActionError(error)) throw error;
        await this.log(
          event,
          key,
          'inbox',
          String(rule.handle),
          targetEntity,
          handle,
          'failed',
          this.message(error),
        );
      }
    }
  }

  private async processFieldRule(
    event: AutomationEventItem,
    rule: FieldAutomationItem,
    claimed: Map<string, number>,
  ): Promise<void> {
    const targetEntity = rule.targetEntity.handle;
    const handles = await this.resolveTargets(
      event,
      targetEntity,
      rule.referencePath,
    );
    for (const handle of handles) {
      const key = `${event.chainId}:field:${rule.handle}:${targetEntity}:${handle}`;
      if (await this.exists(key)) continue;
      const target = await this.loadTargetForEvent(event, targetEntity, handle);
      if (
        !target ||
        !this.conditions.matches(
          rule.conditions,
          event.oldSnapshot,
          event.newSnapshot,
          target,
        )
      )
        continue;
      const assignmentFields = (rule.assignments ?? []).map(
        (item) => item.field,
      );
      const conflict = assignmentFields.some((field) =>
        claimed.has(`${targetEntity}:${handle}:${field}`),
      );
      if (conflict) {
        await this.log(
          event,
          key,
          'field',
          String(rule.handle),
          targetEntity,
          handle,
          'skipped',
          'automation.assignmentConflict',
        );
        continue;
      }
      const changes = Object.fromEntries(
        (rule.assignments ?? []).map((item) => [item.field, item.value]),
      );
      if (
        !Object.keys(changes).length ||
        Object.entries(changes).every(([field, value]) =>
          this.equal(this.conditions.value(target, field), value),
        )
      )
        continue;
      try {
        await this.events.runInChain(event, () =>
          this.runAtomic(async () => {
            await this.generic.update(
              targetEntity,
              handle,
              changes,
              event.actor,
              [],
              {
                suppressNotificationSubscriptions: true,
              },
            );
            await this.log(
              event,
              key,
              'field',
              String(rule.handle),
              targetEntity,
              handle,
              'completed',
            );
          }),
        );
        assignmentFields.forEach((field) =>
          claimed.set(`${targetEntity}:${handle}:${field}`, rule.priority),
        );
      } catch (error) {
        if (!this.isTerminalActionError(error)) throw error;
        await this.log(
          event,
          key,
          'field',
          String(rule.handle),
          targetEntity,
          handle,
          'failed',
          this.message(error),
        );
      }
    }
  }

  private async loadTarget(
    entity: string,
    handle: string,
  ): Promise<Record<string, unknown> | null> {
    const entityClass = ENTITY_MAP[entity] as unknown;
    if (!entityClass) return null;
    const record = await this.em.findOne(
      entityClass as EntityClass<object>,
      { handle },
      { populate: this.pathsFor(entity) as never[] },
    );
    if (!record) return null;
    return this.customFields.hydrateRecords(entity, record);
  }

  private async loadTargetForEvent(
    event: AutomationEventItem,
    targetEntity: string,
    targetHandle: string,
  ): Promise<Record<string, unknown> | null> {
    if (
      event.operation === 'afterDelete' &&
      event.sourceEntity.handle === targetEntity &&
      event.sourceHandle === targetHandle
    )
      return event.oldSnapshot ?? null;
    return this.loadTarget(targetEntity, targetHandle);
  }

  private async resolveTargets(
    event: AutomationEventItem,
    targetEntity: string,
    path: FieldAutomationItem['referencePath'],
  ): Promise<string[]> {
    const snapshots = [event.newSnapshot, event.oldSnapshot].filter(
      (snapshot): snapshot is Record<string, unknown> => snapshot != null,
    );
    if (snapshots.length === 0) snapshots.push({});
    const resolved = await Promise.all(
      snapshots.map((snapshot) =>
        this.paths.resolve(
          event.sourceEntity.handle,
          event.sourceHandle,
          targetEntity,
          path,
          snapshot,
          event.context,
        ),
      ),
    );
    return [...new Set(resolved.flat())];
  }
  private pathsFor(entity: string): string[] {
    return this.paths.population(entity);
  }
  private async canRecipientRead(
    entity: string,
    handle: string,
    recipient: AutomationEventItem['actor'],
    targetWasDeleted: boolean,
  ): Promise<boolean> {
    try {
      this.permissions.checkTopLevelReadPermission(entity, recipient);
      const baseFilter = { handle };
      const filter = this.permissions.setTopLevelFilter(
        baseFilter,
        recipient,
        entity,
      );
      if (targetWasDeleted)
        return JSON.stringify(filter) === JSON.stringify(baseFilter);
      const entityClass = ENTITY_MAP[entity] as unknown;
      if (!entityClass) return false;
      return (
        (await this.em.count(entityClass as EntityClass<object>, filter)) > 0
      );
    } catch {
      return false;
    }
  }
  private async projectRecipientContext(
    event: AutomationEventItem,
    targetEntity: string,
    target: Record<string, unknown>,
    recipient: AutomationEventItem['actor'],
  ): Promise<Record<string, unknown>> {
    const sourceEntity = event.sourceEntity.handle;
    const [targetTemplate, sourceTemplate] = await Promise.all([
      this.fieldPermissions.getTemplates(targetEntity),
      this.fieldPermissions.getTemplates(sourceEntity),
    ]);
    const project = (
      entity: string,
      value: Record<string, unknown> | null | undefined,
      template: Awaited<ReturnType<FieldPermissionService['getTemplates']>>,
    ) =>
      value
        ? this.sanitizer.projectEntityResult(entity, value, recipient, template)
        : {};
    const oldSource = project(sourceEntity, event.oldSnapshot, sourceTemplate);
    const newSource = project(sourceEntity, event.newSnapshot, sourceTemplate);
    return {
      target: project(targetEntity, target, targetTemplate),
      source: event.newSnapshot ? newSource : oldSource,
      oldSource,
      newSource,
    };
  }
  private exists(key: string): Promise<boolean> {
    return this.em
      .count(AutomationExecutionItem, { deduplicationKey: key })
      .then(Boolean);
  }
  private async log(
    event: AutomationEventItem,
    deduplicationKey: string,
    actionType: 'inbox' | 'teams' | 'webhook' | 'field',
    ruleHandle: string,
    targetEntity: string,
    targetHandle: string,
    status: 'completed' | 'skipped' | 'failed',
    message?: string,
  ): Promise<void> {
    const execution = this.em.create(AutomationExecutionItem, {
      event,
      deduplicationKey,
      actionType,
      ruleHandle,
      targetEntity,
      targetHandle,
      status,
      message,
    } as never);
    this.em.persist(execution);
    await this.em.flush();
  }
  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
  private isTerminalActionError(error: unknown): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status >= 400 && status < 500;
    }
    return (
      error instanceof Error &&
      ['global.notActive', 'global.entityNotFound', 'global.notFound'].includes(
        error.message,
      )
    );
  }
  private runAtomic<T>(operation: () => Promise<T>): Promise<T> {
    return typeof this.em.transactional === 'function'
      ? this.em.transactional(operation)
      : operation();
  }
  private equal(left: unknown, right: unknown): boolean {
    const normalize = (value: unknown): unknown =>
      value && typeof value === 'object' && 'handle' in value
        ? (value as { handle?: unknown }).handle
        : value;
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
  }
}
