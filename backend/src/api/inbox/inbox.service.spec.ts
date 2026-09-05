import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../entity/InboxNotificationItem', () => ({
  InboxNotificationItem: class {},
}));
jest.mock('../../entity/InboxSubscriptionItem', () => ({
  InboxSubscriptionItem: class {},
}));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));

import { InboxService } from './inbox.service';

function createService(
  recipients: Array<{ handle: number }>,
  notifyActor = false,
) {
  const subscription = {
    handle: 5,
    isActive: true,
    notifyActor,
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
    persist: jest.fn(),
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

  return { service, em, openTaskEventsService, subscription };
}

describe('InboxService', () => {
  it('includes the actor alongside other recipients when enabled', async () => {
    const { service, em, openTaskEventsService } = createService(
      [{ handle: 7 }, { handle: 11 }],
      true,
    );

    const notifications = await service.querySubscription(5, { handle: 23 }, {
      handle: 7,
    } as never);

    expect(notifications.map((item) => item.recipientPerson)).toEqual([7, 11]);
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(openTaskEventsService.notifyUsers).toHaveBeenCalledWith(
      new Set([7, 11]),
    );
  });

  it.each([false, true])(
    'uses notifyActor=%s for reference automation recipients',
    async (notifyActor) => {
      const { service, em, openTaskEventsService, subscription } =
        createService([{ handle: 7 }, { handle: 11 }], notifyActor);
      em.findOne.mockResolvedValue(null);
      const canRead = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);

      const notifications = await service.queryAutomationSubscription(
        subscription as never,
        { handle: 23 },
        {
          actor: { handle: 7 },
          eventId: 'event-1',
          operation: 'afterUpdate',
        } as never,
        'event-1:inbox:5:23',
        canRead,
      );

      const handles = notifyActor ? [7, 11] : [11];
      expect(
        notifications.map(
          (item) => (item.recipientPerson as { handle: number }).handle,
        ),
      ).toEqual(handles);
      expect(canRead).toHaveBeenCalledTimes(handles.length);
      expect(openTaskEventsService.notifyUsers).toHaveBeenCalledWith(
        new Set(handles),
      );
      expect(em.create).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          automationDeduplicationKey: 'event-1:inbox:5:23:11',
        }),
      );
    },
  );

  it('still checks actor permissions when self-notification is enabled', async () => {
    const { service, em, subscription, openTaskEventsService } = createService(
      [{ handle: 7 }],
      true,
    );
    const notifications = await service.queryAutomationSubscription(
      subscription as never,
      { handle: 23 },
      { actor: { handle: 7 } } as never,
      'denied',
      () => Promise.resolve(false),
    );
    expect(notifications).toEqual([]);
    expect(em.create).not.toHaveBeenCalled();
    expect(openTaskEventsService.notifyUsers).not.toHaveBeenCalled();
  });

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
