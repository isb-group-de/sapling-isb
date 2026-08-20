import { describe, expect, it, jest } from '@jest/globals';
import { EventDeliveryService } from './event.delivery.service';
import type { EventItem } from '../entity/EventItem';
import { EventDeliveryItem } from '../entity/EventDeliveryItem';
import type { EventDeliveryStatusItem } from '../entity/EventDeliveryStatusItem';
import { REDIS_ENABLED } from '../constants/project.constants';

const asMock = (value: unknown): jest.Mock => value as jest.Mock;

describe('EventDeliveryService', () => {
  it('does not create a calendar delivery for completed events', async () => {
    const queue = { add: jest.fn() };
    const calendarDeliveryExecutor = { execute: jest.fn() };
    const em = {
      findOne: jest.fn(),
      persist: jest.fn(),
    };
    const service = new EventDeliveryService(
      em as never,
      queue as never,
      calendarDeliveryExecutor as never,
    );

    await expect(
      service.queueEventDelivery(
        {
          handle: 42,
          type: { showInDefaultCalendar: true },
          status: { handle: 'completed' },
        } as EventItem,
        { provider: 'azure', sessionHandle: 7 },
      ),
    ).resolves.toBeNull();

    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.persist).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(calendarDeliveryExecutor.execute).not.toHaveBeenCalled();
  });

  it('stores only the explicit calendar payload and executes the delivery directly without Redis', async () => {
    const pending = { handle: 'pending' } as EventDeliveryStatusItem;
    const queue = {
      add: jest.fn(() => undefined),
    };
    const event = { handle: 42 } as EventItem;
    const persistedDelivery = {
      handle: 15,
      event,
      payload: {
        provider: 'azure',
        sessionHandle: 7,
      },
    } as EventDeliveryItem;
    const calendarDeliveryExecutor = {
      execute: jest.fn(() => undefined),
    };
    const em = {
      findOne: jest.fn(() => pending),
      findOneOrFail: jest.fn(() => persistedDelivery),
      persist: jest.fn((entity: { handle?: number }) => ({
        flush: jest.fn(() => {
          entity.handle = 15;
        }),
      })),
    };
    const service = new EventDeliveryService(
      em as never,
      queue as never,
      calendarDeliveryExecutor as never,
    );

    const delivery = await service.queueEventDelivery(event, {
      provider: 'azure',
      sessionHandle: 7,
    });

    expect(delivery).not.toBeNull();
    expect(delivery?.event).toBe(event);
    expect(delivery?.payload).toEqual({
      provider: 'azure',
      sessionHandle: 7,
    });
    expect(delivery?.payload).not.toHaveProperty('handle');
    if (REDIS_ENABLED) {
      expect(asMock(queue.add)).toHaveBeenCalledWith('deliver-calendar-event', {
        deliveryId: 15,
      });
      expect(asMock(calendarDeliveryExecutor.execute)).not.toHaveBeenCalled();
    } else {
      expect(asMock(calendarDeliveryExecutor.execute)).toHaveBeenCalledWith(
        15,
        1,
      );
      expect(asMock(queue.add)).not.toHaveBeenCalled();
    }
  });
});
