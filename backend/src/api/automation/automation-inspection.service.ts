import { EntityManager } from '@mikro-orm/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FieldAutomationItem } from '../../entity/FieldAutomationItem';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { EmailSubscriptionItem } from '../../entity/EmailSubscriptionItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { AutomationExecutionItem } from '../../entity/AutomationExecutionItem';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import { TeamsDeliveryItem } from '../../entity/TeamsDeliveryItem';
import { WebhookDeliveryItem } from '../../entity/WebhookDeliveryItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { automationRuleView, buildAutomationGraph } from './automation-graph';

@Injectable()
export class AutomationInspectionService {
  constructor(private readonly em: EntityManager) {}

  async graph(entity: string, depth: number, includeInactive: boolean) {
    this.assertEntity(entity);
    const [field, inbox, email, teams, webhook] = await Promise.all([
      this.em.find(
        FieldAutomationItem,
        {},
        { populate: ['sourceEntity', 'targetEntity', 'operation'] },
      ),
      this.em.find(
        InboxSubscriptionItem,
        {},
        { populate: ['sourceEntity', 'entity', 'type', 'template'] },
      ),
      this.em.find(
        EmailSubscriptionItem,
        {},
        { populate: ['entity', 'type', 'template', 'conditions'] },
      ),
      this.em.find(
        TeamsSubscriptionItem,
        {},
        { populate: ['sourceEntity', 'entity', 'type', 'template'] },
      ),
      this.em.find(
        WebhookSubscriptionItem,
        {},
        { populate: ['sourceEntity', 'entity', 'type'] },
      ),
    ]);
    return buildAutomationGraph(
      [
        ...field.map((r) => automationRuleView(r, 'field')),
        ...inbox.map((r) => automationRuleView(r, 'inbox')),
        ...email.map((r) => automationRuleView(r, 'email')),
        ...teams.map((r) => automationRuleView(r, 'teams')),
        ...webhook.map((r) => automationRuleView(r, 'webhook')),
      ],
      entity,
      depth,
      includeInactive,
    );
  }

  async history(entity: string, handle: string, page: number) {
    this.assertEntity(entity);
    const limit = 25,
      offset = (page - 1) * limit;
    const [executions, emails] = await Promise.all([
      this.em.findAndCount(
        AutomationExecutionItem,
        {
          $or: [
            { targetEntity: { handle: entity }, targetHandle: handle },
            {
              event: { sourceEntity: { handle: entity }, sourceHandle: handle },
            },
          ],
        },
        {
          populate: ['event', 'event.sourceEntity', 'targetEntity'],
          orderBy: { createdAt: 'DESC', handle: 'DESC' },
          limit,
          offset,
        },
      ),
      this.em.findAndCount(
        EmailDeliveryItem,
        {
          entity: { handle: entity },
          referenceHandle: handle,
          subscription: { $ne: null },
        },
        {
          populate: ['status', 'subscription'],
          orderBy: { createdAt: 'DESC', handle: 'DESC' },
          limit,
          offset,
        },
      ),
    ]);
    const keys = executions[0].map((e) => e.deduplicationKey);
    const [teams, webhooks] = keys.length
      ? await Promise.all([
          this.em.find(
            TeamsDeliveryItem,
            { automationDeduplicationKey: { $in: keys } },
            { populate: ['status'] },
          ),
          this.em.find(
            WebhookDeliveryItem,
            { automationDeduplicationKey: { $in: keys } },
            { populate: ['status'] },
          ),
        ])
      : [[], []];
    const delivery = (
      row: EmailDeliveryItem | TeamsDeliveryItem | WebhookDeliveryItem,
      kind: string,
    ) => ({
      handle: row.handle,
      kind,
      status: row.status?.handle ?? 'unknown',
      attemptCount: row.attemptCount,
      completedAt: row.completedAt ?? null,
      nextRetryAt: row.nextRetryAt ?? null,
      responseStatusCode: row.responseStatusCode ?? null,
      createdAt: row.createdAt,
    });
    return {
      page,
      hasMore: executions[1] > offset + limit || emails[1] > offset + limit,
      executionTotal: executions[1],
      emailTotal: emails[1],
      executions: executions[0].map((row) => ({
        handle: row.handle,
        kind: row.actionType,
        ruleHandle: row.ruleHandle,
        status: row.status,
        message: row.message,
        createdAt: row.createdAt,
        ruleSnapshot: row.ruleSnapshot ?? null,
        eventId: row.event.eventId,
        chainId: row.event.chainId,
        eventStatus: row.event.status,
        sourceEntity: row.event.sourceEntity.handle,
        sourceHandle: row.event.sourceHandle,
        targetEntity: row.targetEntity.handle,
        targetHandle: row.targetHandle,
        deliveries: [
          ...teams
            .filter(
              (d) => d.automationDeduplicationKey === row.deduplicationKey,
            )
            .map((d) => delivery(d, 'teams')),
          ...webhooks
            .filter(
              (d) => d.automationDeduplicationKey === row.deduplicationKey,
            )
            .map((d) => delivery(d, 'webhook')),
        ],
      })),
      // These records have no reliable historical event ID; do not infer one by timestamp.
      independentEmails: emails[0].map((row) => ({
        ...delivery(row, 'email'),
        subject: row.subject,
        toRecipients: row.toRecipients,
        ruleSnapshot: row.ruleSnapshot ?? null,
        ruleHandle: row.subscription?.handle,
        chainId: null,
      })),
    };
  }

  private assertEntity(entity: string): void {
    if (!ENTITY_MAP[entity])
      throw new NotFoundException('global.entityNotFound');
  }
}
