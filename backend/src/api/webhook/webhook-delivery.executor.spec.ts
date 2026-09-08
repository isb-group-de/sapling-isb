import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Observable, of, throwError } from 'rxjs';
import { UnrecoverableError } from 'bullmq';
import { WebhookDeliveryExecutor } from './webhook-delivery.executor';

jest.mock('../../entity/WebhookDeliveryItem', () => ({
  WebhookDeliveryItem: class {},
}));
jest.mock('../../entity/WebhookDeliveryStatusItem', () => ({
  WebhookDeliveryStatusItem: class {},
}));

type TestDeliveryStatus = {
  handle: string;
};

type TestDelivery = {
  payload: unknown;
  status?: TestDeliveryStatus;
  subscription: {
    url: string;
    signingSecret: string;
    customHeaders?: undefined;
    containerName?: string;
    payloadType: { handle: string };
    type: { handle: string };
    method: { handle: string };
    authenticationType: { handle: string };
  };
};

type PostResponse = {
  status: number;
  data: { ok: boolean };
  headers: { server: string };
};

describe('WebhookDeliveryExecutor', () => {
  it.each([403, 408, 429, 500])(
    'preserves retry classification and failure evidence for HTTP %i',
    async (status) => {
      const delivery = {
        payload: {},
        subscription: {
          url: 'https://example.invalid/webhook',
          signingSecret: '',
          payloadType: { handle: 'item' },
          type: { handle: 'afterInsert' },
          method: { handle: 'post' },
          authenticationType: { handle: 'none' },
        },
      };
      const failure = Object.assign(new Error('provider rejected request'), {
        response: { status },
      });
      const em = {
        findOne: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValueOnce(delivery)
          .mockResolvedValueOnce({ handle: 'failed' }),
        flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };
      const executor = new WebhookDeliveryExecutor(
        { fork: () => em } as never,
        { post: () => throwError(() => failure) } as never,
      );
      if (status === 403)
        await expect(executor.execute(42, 1)).rejects.toBeInstanceOf(
          UnrecoverableError,
        );
      else await expect(executor.execute(42, 1)).rejects.toBe(failure);
      expect(delivery).toMatchObject({
        status: { handle: 'failed' },
        responseStatusCode: status,
        attemptCount: 1,
      });
      expect(em.flush).toHaveBeenCalledTimes(1);
    },
  );
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps every attempt from the unchanged persisted payload', async () => {
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const successStatus: TestDeliveryStatus = { handle: 'success' };
    const delivery: TestDelivery = {
      payload: [{ handle: 7, description: 'Payload value' }],
      subscription: {
        url: 'https://example.invalid/webhook',
        signingSecret: 'secret',
        customHeaders: undefined,
        containerName: 'container',
        payloadType: { handle: 'item' },
        type: { handle: 'afterInsert' },
        method: { handle: 'post' },
        authenticationType: { handle: 'none' },
      },
    };
    const findOne = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(delivery)
      .mockResolvedValueOnce(successStatus)
      .mockResolvedValueOnce(delivery)
      .mockResolvedValueOnce(successStatus);

    const em = {
      fork: jest.fn(() => ({
        findOne,
        flush,
      })),
    };
    const post = jest
      .fn<
        (
          url: string,
          body: unknown,
          config: unknown,
        ) => Observable<PostResponse>
      >()
      .mockReturnValue(
        of({ status: 200, data: { ok: true }, headers: { server: 'test' } }),
      );
    const httpService = {
      post,
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    const executor = new WebhookDeliveryExecutor(
      em as never,
      httpService as never,
    );

    await executor.execute(42, 1);
    await executor.execute(42, 2);

    const expectedRequestPayload = {
      container: JSON.stringify({ handle: 7, description: 'Payload value' }),
    };

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(
      1,
      'https://example.invalid/webhook',
      expectedRequestPayload,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'afterInsert',
          'X-Webhook-Signature': expect.any(String),
        }),
      }),
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      'https://example.invalid/webhook',
      expectedRequestPayload,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'afterInsert',
          'X-Webhook-Signature': expect.any(String),
        }),
      }),
    );
    expect(delivery.payload).toEqual([
      {
        handle: 7,
        description: 'Payload value',
      },
    ]);
    expect(delivery.status).toBe(successStatus);
    expect(flush).toHaveBeenCalledTimes(2);
  });
});
