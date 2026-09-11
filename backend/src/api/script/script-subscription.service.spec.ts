import type { EntityManager } from '@mikro-orm/core';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { ScriptMethods } from './script.types';
import { ScriptSubscriptionService } from './script-subscription.service';

describe('ScriptSubscriptionService', () => {
  it('does not bypass conditions on legacy subscriptions', async () => {
    global.log = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as never;
    const unconditionalTeams = {
      handle: 1,
      recipientField: 'assigneePerson',
      conditions: [],
    };
    const conditionalTeams = {
      handle: 2,
      recipientField: 'assigneePerson',
      conditions: [
        {
          scope: 'target',
          field: 'assigneePerson',
          operator: 'equals',
          newValue: 2,
        },
      ],
    };
    const em = {
      findAll: jest.fn(async (model: unknown) => {
        if (model === TeamsSubscriptionItem)
          return [unconditionalTeams, conditionalTeams];
        if (model === InboxSubscriptionItem) return [];
        if (model === WebhookSubscriptionItem) return [];
        return [];
      }),
      populate: jest.fn(async () => undefined),
    };
    const teams = { querySubscription: jest.fn(async () => []) };
    const service = new ScriptSubscriptionService(
      em as unknown as EntityManager,
      {} as never,
      teams as never,
      {} as never,
    );

    await service.runSubscription(
      ScriptMethods.afterUpdate,
      { handle: 42, assigneePerson: { handle: 9 } },
      { handle: 'ticket' } as never,
      { handle: 7 } as never,
    );

    expect(teams.querySubscription).toHaveBeenCalledTimes(1);
    expect(teams.querySubscription).toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.anything(),
      ['assigneePerson'],
      expect.anything(),
    );
  });
});
