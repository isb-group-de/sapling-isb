import { describe, expect, it, jest } from '@jest/globals';
import { CalendarDeliveryExecutor } from './calendar-delivery.executor';
import { EventDeliveryItem } from '../entity/EventDeliveryItem';
import { EventDeliveryStatusItem } from '../entity/EventDeliveryStatusItem';
import { PersonSessionItem } from '../entity/PersonSessionItem';

const asMock = (value: unknown): jest.Mock => value as jest.Mock;

describe('CalendarDeliveryExecutor', () => {
  it('resolves the session and forwards focused changed fields to Azure', async () => {
    const delivery = {
      handle: 21,
      event: { handle: 4 },
      payload: {
        provider: 'azure',
        sessionHandle: 8,
        changedFields: ['category'],
      },
      attemptCount: 0,
    } as EventDeliveryItem;
    const success = { handle: 'success' } as EventDeliveryStatusItem;
    const session = {
      handle: 8,
      accessToken: 'azure-token',
      person: { handle: 7 },
    } as PersonSessionItem;
    const emFork = {
      findOne: jest.fn((entity: unknown, where: { handle?: unknown }) => {
        if (entity === EventDeliveryItem) {
          return delivery;
        }
        if (entity === PersonSessionItem) {
          return session;
        }
        if (entity === EventDeliveryStatusItem && where.handle === 'success') {
          return success;
        }
        return null;
      }),
      flush: jest.fn(() => undefined),
    };
    const em = {
      fork: jest.fn(() => emFork),
    };
    const azureCalendarService = {
      setEvent: jest.fn(() => ({ id: 'az-1' })),
    };
    const googleCalendarService = {
      setEvent: jest.fn(() => ({ id: 'g-1' })),
    };
    const executor = new CalendarDeliveryExecutor(
      em as never,
      googleCalendarService as never,
      azureCalendarService as never,
    );

    await executor.execute(21, 1);

    expect(asMock(azureCalendarService.setEvent)).toHaveBeenCalledWith(
      4,
      'azure-token',
      7,
      undefined,
      ['category'],
    );
    expect(asMock(googleCalendarService.setEvent)).not.toHaveBeenCalled();
    expect(delivery.status).toBe(success);
    expect(delivery.responseStatusCode).toBe(200);
    expect(delivery.responseBody).toEqual({ id: 'az-1' });
    expect(emFork.flush).toHaveBeenCalled();
  });

  it('keeps legacy queued payloads with embedded session tokens working', async () => {
    const delivery = {
      handle: 22,
      event: { handle: 5 },
      payload: {
        provider: 'google',
        session: { accessToken: 'legacy-token' },
      },
      attemptCount: 0,
    } as EventDeliveryItem;
    const success = { handle: 'success' } as EventDeliveryStatusItem;
    const emFork = {
      findOne: jest.fn((entity: unknown, where: { handle?: unknown }) => {
        if (entity === EventDeliveryItem) {
          return delivery;
        }
        if (entity === EventDeliveryStatusItem && where.handle === 'success') {
          return success;
        }
        return null;
      }),
      flush: jest.fn(() => undefined),
    };
    const em = {
      fork: jest.fn(() => emFork),
    };
    const azureCalendarService = {
      setEvent: jest.fn(() => ({ id: 'az-1' })),
    };
    const googleCalendarService = {
      setEvent: jest.fn(() => ({ status: 202, data: { ok: true } })),
    };
    const executor = new CalendarDeliveryExecutor(
      em as never,
      googleCalendarService as never,
      azureCalendarService as never,
    );

    await executor.execute(22, 1);

    expect(asMock(googleCalendarService.setEvent)).toHaveBeenCalledWith(
      5,
      'legacy-token',
      undefined,
    );
    expect(asMock(azureCalendarService.setEvent)).not.toHaveBeenCalled();
    expect(delivery.status).toBe(success);
    expect(delivery.responseStatusCode).toBe(202);
    expect(delivery.responseBody).toEqual({ ok: true });
  });

  it('forwards recurrence-removal deliveries explicitly to Azure', async () => {
    const delivery = {
      handle: 23,
      event: { handle: 6 },
      payload: {
        provider: 'azure',
        sessionHandle: 8,
        operation: 'remove-recurrence',
      },
      attemptCount: 0,
    } as EventDeliveryItem;
    const success = { handle: 'success' } as EventDeliveryStatusItem;
    const session = {
      handle: 8,
      accessToken: 'azure-token',
      person: { handle: 7 },
    } as PersonSessionItem;
    const emFork = {
      findOne: jest.fn((entity: unknown, where: { handle?: unknown }) => {
        if (entity === EventDeliveryItem) {
          return delivery;
        }
        if (entity === PersonSessionItem) {
          return session;
        }
        if (entity === EventDeliveryStatusItem && where.handle === 'success') {
          return success;
        }
        return null;
      }),
      flush: jest.fn(() => undefined),
    };
    const azureCalendarService = {
      setEvent: jest.fn(() => ({ id: 'az-2' })),
    };
    const executor = new CalendarDeliveryExecutor(
      { fork: jest.fn(() => emFork) } as never,
      { setEvent: jest.fn() } as never,
      azureCalendarService as never,
    );

    await executor.execute(23, 1);

    expect(asMock(azureCalendarService.setEvent)).toHaveBeenCalledWith(
      6,
      'azure-token',
      7,
      'remove-recurrence',
    );
    expect(delivery.status).toBe(success);
  });

  it('persists provider failures without a non-executable email fallback', async () => {
    const delivery = {
      handle: 24,
      event: { handle: 7 },
      payload: {
        provider: 'azure',
        sessionHandle: 8,
      },
      attemptCount: 0,
    } as EventDeliveryItem;
    const failed = { handle: 'failed' } as EventDeliveryStatusItem;
    const session = {
      handle: 8,
      accessToken: 'azure-token',
      person: { handle: 7 },
    } as PersonSessionItem;
    const emFork = {
      findOne: jest.fn((entity: unknown, where: { handle?: unknown }) => {
        if (entity === EventDeliveryItem) {
          return delivery;
        }
        if (entity === PersonSessionItem) {
          return session;
        }
        if (entity === EventDeliveryStatusItem && where.handle === 'failed') {
          return failed;
        }
        return null;
      }),
      flush: jest.fn(() => undefined),
    };
    const azureCalendarService = {
      setEvent: jest.fn(() =>
        Promise.reject({
          statusCode: 500,
          message: 'Microsoft Graph failed',
          body: { error: { code: 'InternalServerError' } },
        }),
      ),
    };
    const executor = new CalendarDeliveryExecutor(
      { fork: jest.fn(() => emFork) } as never,
      { setEvent: jest.fn() } as never,
      azureCalendarService as never,
    );

    await executor.execute(24, 1);

    expect(delivery.status).toBe(failed);
    expect(delivery.responseStatusCode).toBe(500);
    expect(delivery.responseBody).toEqual({
      providerError: {
        status: 500,
        message: 'Microsoft Graph failed',
        body: { error: { code: 'InternalServerError' } },
      },
    });
    expect(delivery.responseBody).not.toHaveProperty('fallback');
    expect(emFork.flush).toHaveBeenCalled();
  });
});
