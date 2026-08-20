import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../entity/InboxNotificationItem', () => ({
  InboxNotificationItem: class {},
}));
jest.mock('../../entity/InboxSubscriptionItem', () => ({
  InboxSubscriptionItem: class {},
}));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));

import { InboxService } from './inbox.service';

function createService(recipients: Array<{ handle: number }>) {
  const subscription = {
    handle: 5,
    isActive: true,
    recipientField: 'assigneePerson',
    entity: { handle: 'ticket' },
    type: { handle: 'afterUpdate' },
    template: {
      handle: 9,
      isActive: true,
      name: 'Ticket updated',
      titleTemplate: 'Ticket updated',
      bodyMarkdown: 'The ticket was updated.',
    },
  };
  const flush = jest.fn<() => Promise<void>>().mockResolvedValue();
  const create = jest.fn((_entity: unknown, data: object) => data);
  const em = {
    findOne: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(subscription),
    find: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(recipients),
    create,
    flush,
  };
  const messageTemplateService = {
    loadEntityContext: jest
      .fn<(...args: unknown[]) => Promise<object>>()
      .mockResolvedValue({ assigneePerson: recipients }),
    getContextValue: jest.fn(() => recipients),
    replacePlaceholders: jest.fn((template: string) => template),
    stripMarkdown: jest.fn((markdown: string) => markdown),
  };
  const openTaskEventsService = {
    notifyUsers: jest.fn(),
  };
  const service = new InboxService(
    em as never,
    messageTemplateService as never,
    openTaskEventsService as never,
  );

  return { service, em, openTaskEventsService };
}

describe('InboxService', () => {
  it('does not create or announce a notification for the acting user', async () => {
    const { service, em, openTaskEventsService } = createService([
      { handle: 7 },
    ]);

    const notifications = await service.querySubscription(5, { handle: 23 }, {
      handle: 7,
    } as never);

    expect(notifications).toEqual([]);
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
    expect(openTaskEventsService.notifyUsers).not.toHaveBeenCalled();
  });

  it('keeps notifications for other recipients in a mixed recipient list', async () => {
    const { service, em, openTaskEventsService } = createService([
      { handle: 7 },
      { handle: 11 },
    ]);

    const notifications = await service.querySubscription(5, { handle: 23 }, {
      handle: 7,
    } as never);

    expect(notifications).toHaveLength(1);
    expect(em.create).toHaveBeenCalledTimes(1);
    expect(em.create).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        createdBy: 7,
        recipientPerson: 11,
        referenceHandle: '23',
      }),
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(openTaskEventsService.notifyUsers).toHaveBeenCalledWith(
      new Set([11]),
    );
  });
});
