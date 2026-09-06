import { InboxService } from './inbox.service';
import { InboxNotificationItem } from '../../entity/InboxNotificationItem';

function harness(changed = 1) {
  const notification = {
    handle: 7,
    isRead: true,
    readAt: new Date('2026-09-03T12:00:00Z'),
  };
  const fork = {
    nativeUpdate: jest.fn().mockResolvedValue(changed),
    findOne: jest.fn().mockResolvedValue(notification),
  };
  const em = { fork: jest.fn(() => fork), flush: jest.fn() };
  const events = { notifyUsers: jest.fn() };
  return {
    service: new InboxService(em as never, {} as never, events as never),
    em,
    fork,
    events,
    notification,
  };
}

describe('Inbox read acknowledgements', () => {
  it('updates only an unread notification owned by the caller without flushing a graph', async () => {
    const h = harness();
    await expect(
      h.service.markNotificationRead(7, { handle: 11 }),
    ).resolves.toBe(h.notification);
    expect(h.fork.nativeUpdate).toHaveBeenCalledWith(
      InboxNotificationItem,
      { handle: 7, recipientPerson: { handle: 11 }, isRead: false },
      {
        isRead: true,
        readAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
      },
    );
    expect(h.fork.findOne).toHaveBeenCalledWith(
      InboxNotificationItem,
      { handle: 7, recipientPerson: { handle: 11 } },
      expect.objectContaining({ populate: expect.any(Array) as string[] }),
    );
    expect(h.events.notifyUsers).toHaveBeenCalledTimes(1);
    expect(h.em.flush).not.toHaveBeenCalled();
  });
  it('keeps readAt and emits no event on a repeated acknowledgement', async () => {
    const h = harness(0);
    await expect(
      h.service.markNotificationRead(7, { handle: 11 }),
    ).resolves.toBe(h.notification);
    expect(h.notification.readAt.toISOString()).toBe(
      '2026-09-03T12:00:00.000Z',
    );
    expect(h.events.notifyUsers).not.toHaveBeenCalled();
  });
  it('does not acknowledge another recipients notification', async () => {
    const h = harness(0);
    h.fork.findOne.mockResolvedValue(null);
    await expect(
      h.service.markNotificationRead(7, { handle: 99 }),
    ).rejects.toThrow('global.entityNotFound');
    expect(h.events.notifyUsers).not.toHaveBeenCalled();
  });
  it.each([undefined, NaN, 0, -1])(
    'rejects invalid user handles before querying: %s',
    async (handle) => {
      const h = harness();
      await expect(
        h.service.markNotificationRead(7, { handle }),
      ).rejects.toThrow('global.entityNotFound');
      expect(h.em.fork).not.toHaveBeenCalled();
    },
  );
});
