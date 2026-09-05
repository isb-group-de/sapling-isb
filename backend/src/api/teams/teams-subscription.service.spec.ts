import { describe, expect, it, jest } from '@jest/globals';
import { TeamsService } from './teams.service';
import { TeamsSubscriptionItem } from '../../entity/TeamsSubscriptionItem';
import { TeamsDeliveryItem } from '../../entity/TeamsDeliveryItem';
import { TeamsDeliveryStatusItem } from '../../entity/TeamsDeliveryStatusItem';
import { PersonItem } from '../../entity/PersonItem';

jest.mock('../../constants/project.constants', () => ({ REDIS_ENABLED: true }));

function createService(notifyActor: boolean, recipientHandle = 7) {
  const actor = {
    handle: 7,
    type: { handle: 'azure' },
    loginName: 'actor@example.com',
  };
  const recipient = {
    handle: recipientHandle,
    type: { handle: 'azure' },
    loginName: 'recipient@example.com',
  };
  const subscription = {
    handle: 5,
    isActive: true,
    notifyActor,
    recipientField: 'assigneePerson',
    entity: { handle: 'ticket' },
    type: { handle: 'afterUpdate' },
    template: { isActive: true, bodyMarkdown: 'Updated' },
  };
  const flush = jest.fn<() => Promise<void>>().mockResolvedValue();
  const persist = jest.fn((delivery: TeamsDeliveryItem) => {
    delivery.handle = 19;
    return { flush };
  });
  const em = {
    findOne: jest.fn(
      (
        entity: unknown,
        filter: { handle?: number | string },
        options?: { populate: string[] },
      ) => {
        if (entity === TeamsSubscriptionItem)
          return Promise.resolve(subscription);
        if (entity === TeamsDeliveryStatusItem)
          return Promise.resolve({ handle: filter.handle });
        if (entity === PersonItem)
          return Promise.resolve(
            options?.populate.includes('session') ? actor : recipient,
          );
        return Promise.resolve(null);
      },
    ),
    persist,
  };
  const templates = {
    loadEntityContext: jest
      .fn<() => Promise<object>>()
      .mockResolvedValue({ assigneePerson: recipient }),
    getContextValue: jest.fn(() => recipient),
    replacePlaceholders: jest.fn((value: string) => value),
    renderMarkdown: jest.fn((value: string) => value),
  };
  const queue = {
    add: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(),
  };
  const service = new TeamsService(
    em as never,
    templates as never,
    queue as never,
  );
  return { service, em, queue, actor };
}

describe('Teams subscription self-notifications', () => {
  it.each([
    { notifyActor: false, recipient: 7, expected: 0 },
    { notifyActor: true, recipient: 7, expected: 1 },
    { notifyActor: false, recipient: 11, expected: 1 },
    { notifyActor: true, recipient: 11, expected: 1 },
  ])(
    'handles $notifyActor with recipient $recipient',
    async ({ notifyActor, recipient, expected }) => {
      const { service, em, queue, actor } = createService(
        notifyActor,
        recipient,
      );
      const deliveries = await service.querySubscription(
        5,
        { handle: 23 },
        actor as PersonItem,
      );
      expect(deliveries).toHaveLength(expected);
      expect(em.persist).toHaveBeenCalledTimes(expected);
      expect(queue.add).toHaveBeenCalledTimes(expected);
    },
  );

  it.each([false, true])(
    'applies notifyActor=%s in the automation path',
    async (notifyActor) => {
      const { service, em, queue, actor } = createService(notifyActor);
      const canRead = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
      const deliveries = await service.querySubscription(
        5,
        { handle: 23 },
        actor as PersonItem,
        [],
        {},
        { source: { handle: 31 }, currentUser: actor },
        'event-1:teams:5:23',
        canRead,
      );
      expect(deliveries).toHaveLength(notifyActor ? 1 : 0);
      expect(em.persist).toHaveBeenCalledTimes(notifyActor ? 1 : 0);
      expect(canRead).toHaveBeenCalledTimes(notifyActor ? 1 : 0);
      if (notifyActor) {
        expect(queue.add).toHaveBeenCalledWith(
          'deliver-teams-message',
          { deliveryId: 19 },
          { jobId: 'automation-teams-19' },
        );
      } else {
        expect(queue.add).not.toHaveBeenCalled();
      }
    },
  );

  it('retains permission checks for enabled self-notifications', async () => {
    const { service, queue, actor } = createService(true);
    const deliveries = await service.querySubscription(
      5,
      { handle: 23 },
      actor as PersonItem,
      [],
      {},
      {},
      'denied',
      () => Promise.resolve(false),
    );
    expect(deliveries[0].status?.handle).toBe('failed');
    expect(deliveries[0].responseStatusCode).toBe(403);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
