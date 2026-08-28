import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../calendar/azure/azure.calendar.service', () => ({
  AzureCalendarService: class {},
}));
jest.mock('../calendar/google/google.calendar.service', () => ({
  GoogleCalendarService: class {},
}));
jest.mock('../entity/EntityItem', () => ({ EntityItem: class {} }));
jest.mock('../entity/EventItem', () => ({ EventItem: class {} }));
jest.mock('../entity/PersonItem', () => ({ PersonItem: class {} }));

import { EventController } from './EventController';
import type { EventItem } from '../entity/EventItem';
import type { PersonItem } from '../entity/PersonItem';
import { ScriptResultServerMethods } from './core/script.result.server';

const asMock = (value: unknown): jest.Mock => value as jest.Mock;

describe('EventController', () => {
  beforeEach(() => {
    global.log = {
      trace: jest.fn(),
      warn: jest.fn(),
    } as unknown as typeof global.log;
  });

  it('queues inserted events for azure users with a session', async () => {
    const azureQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const googleQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const azureCalendarService = {
      queueEvent: azureQueueEvent,
    };
    const googleCalendarService = {
      queueEvent: googleQueueEvent,
    };
    const user = {
      type: { handle: 'azure' },
      session: { provider: 'azure' },
    } as unknown as PersonItem;
    const items = [{ handle: 1 }, { handle: 2 }] as EventItem[];
    const controller = new EventController(
      { handle: 'event' } as never,
      user,
      {} as never,
      azureCalendarService as never,
      googleCalendarService as never,
    );

    const result = await controller.afterInsert(items);

    expect(asMock(azureQueueEvent)).toHaveBeenNthCalledWith(
      1,
      items[0],
      user.session,
    );
    expect(asMock(azureQueueEvent)).toHaveBeenNthCalledWith(
      2,
      items[1],
      user.session,
    );
    expect(asMock(googleQueueEvent)).not.toHaveBeenCalled();
    expect(result.items).toBe(items);
    expect(result.method).toBe(ScriptResultServerMethods.none);
  });

  it('defers materialized event deliveries until after commit and reloads their ids', async () => {
    const azureQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const persistedItems = new Map<number, EventItem>([
      [1, { handle: 1 } as EventItem],
      [2, { handle: 2 } as EventItem],
    ]);
    const em = {
      findOne: jest.fn((_entity: unknown, where: { handle: number }) =>
        Promise.resolve(persistedItems.get(where.handle) ?? null),
      ),
    };
    const user = {
      type: { handle: 'azure' },
      session: { handle: 8 },
    } as unknown as PersonItem;
    const controller = new EventController(
      { handle: 'event' } as never,
      user,
      em as never,
      { queueEvent: azureQueueEvent } as never,
      {} as never,
    );
    const postCommitTasks: Array<{
      label: string;
      operation: () => Promise<void>;
    }> = [];

    await controller.afterInsert(
      [{ handle: 1 }, { handle: 2 }] as EventItem[],
      {
        suppressNotificationSubscriptions: true,
        postCommitTasks,
      },
    );

    expect(azureQueueEvent).not.toHaveBeenCalled();
    expect(postCommitTasks.map((task) => task.label)).toEqual([
      'calendarDelivery:afterInsert:1',
      'calendarDelivery:afterInsert:2',
    ]);

    for (const task of postCommitTasks) {
      await task.operation();
    }

    expect(em.findOne).toHaveBeenCalledTimes(2);
    expect(asMock(azureQueueEvent)).toHaveBeenNthCalledWith(
      1,
      persistedItems.get(1),
      user.session,
    );
    expect(asMock(azureQueueEvent)).toHaveBeenNthCalledWith(
      2,
      persistedItems.get(2),
      user.session,
    );
  });

  it('persists the explicit recurrence-removal operation in the source delivery', async () => {
    const azureQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const persistedEvent = { handle: 1 } as EventItem;
    const em = {
      findOne: jest.fn(() => Promise.resolve(persistedEvent)),
    };
    const user = {
      type: { handle: 'azure' },
      session: { handle: 8 },
    } as unknown as PersonItem;
    const controller = new EventController(
      { handle: 'event' } as never,
      user,
      em as never,
      { queueEvent: azureQueueEvent } as never,
      {} as never,
    );
    const postCommitTasks: Array<{
      label: string;
      operation: () => Promise<void>;
    }> = [];

    await controller.afterUpdate([persistedEvent], {
      calendarDeliveryOperation: 'remove-recurrence',
      postCommitTasks,
    });
    await postCommitTasks[0].operation();

    expect(asMock(azureQueueEvent)).toHaveBeenCalledWith(
      persistedEvent,
      user.session,
      'remove-recurrence',
    );
  });

  it('queues updated events for google users with a session', async () => {
    const azureQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const googleQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const azureCalendarService = {
      queueEvent: azureQueueEvent,
    };
    const googleCalendarService = {
      queueEvent: googleQueueEvent,
    };
    const user = {
      type: { handle: 'google' },
      session: { provider: 'google' },
    } as unknown as PersonItem;
    const items = [{ handle: 5 }] as EventItem[];
    const controller = new EventController(
      { handle: 'event' } as never,
      user,
      {} as never,
      azureCalendarService as never,
      googleCalendarService as never,
    );

    const result = await controller.afterUpdate(items, {
      changedFields: ['category'],
    });

    expect(asMock(googleQueueEvent)).toHaveBeenCalledWith(
      items[0],
      user.session,
      undefined,
      ['category'],
    );
    expect(asMock(azureQueueEvent)).not.toHaveBeenCalled();
    expect(result.items).toBe(items);
    expect(result.method).toBe(ScriptResultServerMethods.none);
  });

  it('does not queue calendar delivery for internal-only event changes', async () => {
    const azureQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const user = {
      type: { handle: 'azure' },
      session: { provider: 'azure' },
    } as unknown as PersonItem;
    const items = [{ handle: 5 }] as EventItem[];
    const controller = new EventController(
      { handle: 'event' } as never,
      user,
      {} as never,
      { queueEvent: azureQueueEvent } as never,
      {} as never,
    );

    await controller.afterUpdate(items, {
      changedFields: [
        'ticket',
        'salesOpportunity',
        'customFields.customerNote',
      ],
    });

    expect(azureQueueEvent).not.toHaveBeenCalled();
  });

  it('queues participant relation changes but skips internal relations', async () => {
    const azureQueueEvent = jest.fn(() => Promise.resolve(undefined));
    const user = {
      type: { handle: 'azure' },
      session: { provider: 'azure' },
    } as unknown as PersonItem;
    const event = { handle: 5 } as EventItem;
    const controller = new EventController(
      { handle: 'event' } as never,
      user,
      {} as never,
      { queueEvent: azureQueueEvent } as never,
      {} as never,
    );

    await controller.afterUpdate([event], { referenceName: 'ticket' });
    expect(azureQueueEvent).not.toHaveBeenCalled();

    await controller.afterUpdate([event], { referenceName: 'participants' });
    expect(asMock(azureQueueEvent)).toHaveBeenCalledWith(
      event,
      user.session,
      undefined,
      ['participants'],
    );
  });
});
