import { describe, expect, it, jest } from '@jest/globals';
import { AutomationEventService } from './automation-event.service';

describe('AutomationEventService', () => {
  it('skips an after-delete event when the deleted person is the actor', async () => {
    const em = {
      findOne: jest.fn(),
      create: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn(),
    };
    const service = new AutomationEventService(em as never);

    await expect(
      service.record({
        entityHandle: 'person',
        sourceHandle: 14,
        operation: 'afterDelete',
        actor: { handle: 14 } as never,
      }),
    ).resolves.toBeNull();

    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('records an after-delete event when another person is the actor', async () => {
    const sourceEntity = { handle: 'person' };
    const event = { handle: 41 };
    const em = {
      findOne: jest.fn<() => Promise<object>>(() =>
        Promise.resolve(sourceEntity),
      ),
      create: jest.fn<(_entity: unknown, _data: object) => object>(() => event),
      persist: jest.fn<(_event: object) => void>(),
      flush: jest.fn(() => Promise.resolve()),
    };
    const service = new AutomationEventService(em as never);

    await expect(
      service.record({
        entityHandle: 'person',
        sourceHandle: 14,
        operation: 'afterDelete',
        actor: { handle: 7 } as never,
      }),
    ).resolves.toBe(event);

    expect(em.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceEntity,
        sourceHandle: '14',
        operation: 'afterDelete',
        actor: 7,
      }),
    );
    expect(em.persist).toHaveBeenCalledWith(event);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});
