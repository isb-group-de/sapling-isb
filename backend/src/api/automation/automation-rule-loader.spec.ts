import type { EntityManager } from '@mikro-orm/core';
import { FieldAutomationItem } from '../../entity/FieldAutomationItem';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { loadAutomationRules } from './automation-rule-loader';

describe('loadAutomationRules', () => {
  it('routes conditional implicit-source subscriptions through the durable processor', async () => {
    const explicit = {
      handle: 1,
      sourceEntity: { handle: 'ticket' },
      entity: { handle: 'ticket' },
      conditions: [],
    };
    const implicitConditional = {
      handle: 2,
      sourceEntity: null,
      entity: { handle: 'ticket' },
      conditions: [{ scope: 'target', field: 'assigneePerson' }],
    };
    const implicitUnconditional = {
      handle: 3,
      sourceEntity: null,
      entity: { handle: 'ticket' },
      conditions: [],
    };
    const em = {
      find: jest.fn(async (model: unknown) => {
        if (model === FieldAutomationItem) return [];
        return [explicit, implicitConditional, implicitUnconditional];
      }),
    };

    const result = await loadAutomationRules(
      em as unknown as EntityManager,
      'ticket',
      'afterUpdate',
    );

    expect(result.inboxRules.map((rule) => rule.handle)).toEqual([1, 2]);
    expect(result.teamsRules.map((rule) => rule.handle)).toEqual([1, 2]);
    expect(result.webhookRules.map((rule) => rule.handle)).toEqual([1, 2]);
    expect(em.find).toHaveBeenCalledWith(
      TeamsSubscriptionItem,
      expect.objectContaining({
        isActive: true,
        type: { handle: 'afterUpdate' },
        $or: [
          { sourceEntity: { handle: 'ticket' } },
          { sourceEntity: null, entity: { handle: 'ticket' } },
        ],
      }),
      expect.anything(),
    );
    expect(em.find).toHaveBeenCalledWith(
      InboxSubscriptionItem,
      expect.anything(),
      expect.anything(),
    );
    expect(em.find).toHaveBeenCalledWith(
      WebhookSubscriptionItem,
      expect.anything(),
      expect.anything(),
    );
  });
});
