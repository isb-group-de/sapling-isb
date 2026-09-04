import { EntityManager } from '@mikro-orm/core';
import { AutomationEventItem } from '../../entity/AutomationEventItem';
import { FieldAutomationItem } from '../../entity/FieldAutomationItem';
import { InboxSubscriptionItem } from '../../entity/InboxSubscriptionItem';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { WebhookSubscriptionItem } from '../../entity/WebhookSubscriptionItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { AutomationConditionService } from './automation-condition.service';
import { AutomationProcessorService } from './automation-processor.service';

describe('AutomationProcessorService', () => {
  it('uses one conditional reference event for Inbox, Teams, webhooks, and field updates', async () => {
    const actor = { handle: 7 };
    const event = {
      handle: 41,
      eventId: 'event-41',
      sourceEntity: { handle: 'document' },
      sourceHandle: '91',
      operation: 'afterInsert',
      actor,
      chainId: 'chain-41',
      chainDepth: 0,
      attemptCount: 0,
      status: 'pending',
      newSnapshot: {
        handle: 91,
        type: { handle: 'email' },
        entity: { handle: 'ticket' },
        reference: '123',
      },
      oldSnapshot: null,
      context: null,
    } as unknown as AutomationEventItem;
    const condition = [
      {
        scope: 'source' as const,
        field: 'type',
        operator: 'equals' as const,
        newValue: 'email',
      },
    ];
    const targetEntity = { handle: 'ticket' };
    const inboxRule = {
      handle: 1,
      entity: targetEntity,
      conditions: condition,
      referencePath: [{ field: 'reference', entity: 'ticket' }],
    } as unknown as InboxSubscriptionItem;
    const teamsRule = {
      ...inboxRule,
      handle: 2,
    } as unknown as TeamsSubscriptionItem;
    const webhookRule = {
      ...inboxRule,
      handle: 3,
    } as unknown as WebhookSubscriptionItem;
    const fieldRule = {
      handle: 4,
      targetEntity,
      conditions: condition,
      referencePath: inboxRule.referencePath,
      assignments: [{ field: 'status', value: 'open' }],
      priority: 100,
    } as unknown as FieldAutomationItem;
    const target = { handle: 123, status: { handle: 'waiting' } };
    let eventRead = false;
    const em = {
      findOne: jest.fn(async (model: unknown) => {
        if (model === AutomationEventItem) {
          if (eventRead) return null;
          eventRead = true;
          return event;
        }
        if (model === ENTITY_MAP.ticket) return target;
        return null;
      }),
      find: jest.fn(async (model: unknown) => {
        if (model === InboxSubscriptionItem) return [inboxRule];
        if (model === TeamsSubscriptionItem) return [teamsRule];
        if (model === WebhookSubscriptionItem) return [webhookRule];
        if (model === FieldAutomationItem) return [fieldRule];
        return [];
      }),
      nativeUpdate: jest.fn(async (...args: unknown[]) => {
        void args;
        return 1;
      }),
      count: jest.fn(async () => 0),
      create: jest.fn((_model: unknown, value: object) => value),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
    };
    const events = {
      registerProcessor: jest.fn(),
      runInChain: jest.fn(
        async (
          _sourceEvent: AutomationEventItem,
          operation: () => Promise<unknown>,
        ) => operation(),
      ),
    };
    const paths = {
      resolve: jest.fn(async () => ['123']),
      population: jest.fn(() => []),
    };
    const generic = { update: jest.fn(async () => target) };
    const inbox = { queryAutomationSubscription: jest.fn(async () => []) };
    const teams = { querySubscription: jest.fn(async () => undefined) };
    const webhooks = { querySubscription: jest.fn(async () => undefined) };
    const service = new AutomationProcessorService(
      em as unknown as EntityManager,
      events as never,
      paths as never,
      new AutomationConditionService(),
      generic as never,
      {
        checkTopLevelReadPermission: jest.fn(),
        setTopLevelFilter: jest.fn((where: object) => where),
      } as never,
      { getTemplates: jest.fn(async () => []) } as never,
      {
        projectEntityResult: jest.fn((_entity: string, value: object) => value),
      } as never,
      {
        hydrateRecords: jest.fn(async (_entity: string, item: object) => item),
      } as never,
      inbox as never,
      teams as never,
      webhooks as never,
    );

    await service.processPending();

    expect(inbox.queryAutomationSubscription).toHaveBeenCalledTimes(1);
    expect(teams.querySubscription).toHaveBeenCalledTimes(1);
    expect(webhooks.querySubscription).toHaveBeenCalledTimes(1);
    expect(generic.update).toHaveBeenCalledWith(
      'ticket',
      '123',
      { status: 'open' },
      actor,
      [],
      { suppressNotificationSubscriptions: true },
    );
    expect(em.create).toHaveBeenCalledTimes(4);
    expect(em.nativeUpdate).toHaveBeenLastCalledWith(
      AutomationEventItem,
      { handle: 41, status: 'processing' },
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('returns technical action failures to the durable event retry', async () => {
    const event = {
      handle: 52,
      eventId: 'event-52',
      sourceEntity: { handle: 'document' },
      sourceHandle: '91',
      operation: 'afterInsert',
      actor: { handle: 7 },
      chainId: 'chain-52',
      chainDepth: 0,
      attemptCount: 0,
      status: 'pending',
      newSnapshot: { handle: 91 },
      oldSnapshot: null,
      context: null,
    } as unknown as AutomationEventItem;
    const rule = {
      handle: 8,
      entity: { handle: 'document' },
      conditions: [],
      referencePath: [],
    } as unknown as InboxSubscriptionItem;
    let eventRead = false;
    const em = {
      findOne: jest.fn(async (model: unknown) => {
        if (model === AutomationEventItem) {
          if (eventRead) return null;
          eventRead = true;
          return event;
        }
        if (model === ENTITY_MAP.document) return { handle: 91 };
        return null;
      }),
      find: jest.fn(async (model: unknown) =>
        model === InboxSubscriptionItem ? [rule] : [],
      ),
      nativeUpdate: jest.fn(async (...args: unknown[]) => {
        void args;
        return 1;
      }),
      count: jest.fn(async () => 0),
      create: jest.fn((_model: unknown, value: object) => value),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
      transactional: jest.fn(async (operation: () => Promise<unknown>) =>
        operation(),
      ),
    };
    const service = new AutomationProcessorService(
      em as unknown as EntityManager,
      { registerProcessor: jest.fn() } as never,
      {
        resolve: jest.fn(async () => ['91']),
        population: jest.fn(() => []),
      } as never,
      new AutomationConditionService(),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        hydrateRecords: jest.fn(async (_entity: string, item: object) => item),
      } as never,
      {
        queryAutomationSubscription: jest.fn(async () => {
          throw new Error('database unavailable');
        }),
      } as never,
      {} as never,
      {} as never,
    );

    await service.processPending();

    const lastUpdate = em.nativeUpdate.mock.calls[
      em.nativeUpdate.mock.calls.length - 1
    ]?.[2] as { status?: string; error?: string; nextAttemptAt?: unknown };
    expect(lastUpdate).toMatchObject({
      status: 'pending',
      error: 'database unavailable',
    });
    expect(lastUpdate.nextAttemptAt).toBeInstanceOf(Date);
    expect(em.create).not.toHaveBeenCalled();
  });
});
