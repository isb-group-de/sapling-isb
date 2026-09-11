import { EntityManager } from '@mikro-orm/core';
import { FieldAutomationItem } from '../../entity/FieldAutomationItem';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { usesDurableAutomationProcessor } from './automation-rule-routing.util';

/** Loads the active, ordered rule configuration once for one source event. */
export async function loadAutomationRules(
  em: EntityManager,
  source: string,
  operation: string,
) {
  const inboxRules = await em.find(
    InboxSubscriptionItem,
    {
      isActive: true,
      type: { handle: operation },
      $or: [
        { sourceEntity: { handle: source } },
        { sourceEntity: null, entity: { handle: source } },
      ],
    },
    {
      populate: ['sourceEntity', 'entity', 'template', 'type'],
      orderBy: { priority: 'DESC', handle: 'ASC' },
    },
  );
  const fieldRules = await em.find(
    FieldAutomationItem,
    {
      isActive: true,
      sourceEntity: { handle: source },
      operation: { handle: operation },
    },
    {
      populate: ['sourceEntity', 'targetEntity', 'operation'],
      orderBy: { priority: 'DESC', handle: 'ASC' },
    },
  );
  const teamsRules = await em.find(
    TeamsSubscriptionItem,
    {
      isActive: true,
      type: { handle: operation },
      $or: [
        { sourceEntity: { handle: source } },
        { sourceEntity: null, entity: { handle: source } },
      ],
    },
    {
      populate: ['sourceEntity', 'entity', 'template', 'type'],
      orderBy: { priority: 'DESC', handle: 'ASC' },
    },
  );
  const webhookRules = await em.find(
    WebhookSubscriptionItem,
    {
      isActive: true,
      type: { handle: operation },
      $or: [
        { sourceEntity: { handle: source } },
        { sourceEntity: null, entity: { handle: source } },
      ],
    },
    {
      populate: ['sourceEntity', 'entity', 'type'],
      orderBy: { priority: 'DESC', handle: 'ASC' },
    },
  );

  return {
    inboxRules: inboxRules.filter(usesDurableAutomationProcessor),
    fieldRules,
    teamsRules: teamsRules.filter(usesDurableAutomationProcessor),
    webhookRules: webhookRules.filter(usesDurableAutomationProcessor),
  };
}
