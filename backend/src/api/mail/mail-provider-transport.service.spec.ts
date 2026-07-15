import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@mikro-orm/core', () => ({
  DeferMode: {
    INITIALLY_DEFERRED: 'deferred',
    INITIALLY_IMMEDIATE: 'immediate',
  },
  EntityManager: class EntityManager {},
  Type: class Type {},
}));
jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_MAP: {},
}));
jest.mock('../../entity/DocumentItem', () => ({
  DocumentItem: class DocumentItem {},
}));
jest.mock('../../entity/EmailDeliveryItem', () => ({
  EmailDeliveryItem: class EmailDeliveryItem {},
}));
jest.mock('../../entity/PersonSessionItem', () => ({
  PersonSessionItem: class PersonSessionItem {},
}));
jest.mock('./mail-provider-session.service', () => ({
  MailProviderSessionService: class MailProviderSessionService {},
}));

import { MailProviderTransportService } from './mail-provider-transport.service';

function createDelivery(accessToken?: string) {
  return {
    provider: 'azure',
    requestPayload: {},
    createdBy: {
      session: {
        accessToken,
        refreshToken: 'refresh-token',
      },
    },
  };
}

function createTransport() {
  const sessionService = {
    refreshAccessToken: jest.fn<(...args: any[]) => Promise<string | null>>(),
  };
  const service = new MailProviderTransportService(
    { stripMarkdown: jest.fn((value: string) => value) } as never,
    sessionService as never,
  );
  const sendWithAccessToken = jest.fn<(...args: any[]) => Promise<unknown>>();
  (
    service as never as {
      sendWithAccessToken: typeof sendWithAccessToken;
    }
  ).sendWithAccessToken = sendWithAccessToken;
  return { service, sessionService, sendWithAccessToken };
}

describe('MailProviderTransportService', () => {
  it('retries delivery after structured authentication failures', async () => {
    const { service, sessionService, sendWithAccessToken } = createTransport();
    const delivery = createDelivery('stale-token');
    sendWithAccessToken
      .mockRejectedValueOnce({
        statusCode: 401,
        body: { error: { code: 'InvalidAuthenticationToken' } },
        message: 'Expired token',
      })
      .mockResolvedValueOnce({ responseStatusCode: 202 });
    sessionService.refreshAccessToken.mockResolvedValue('fresh-token');

    const result = await service.send(delivery as never, [], {} as never);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sendWithAccessToken).toHaveBeenNthCalledWith(
      1,
      'azure',
      delivery,
      delivery.createdBy.session,
      'stale-token',
      [],
      undefined,
    );
    expect(sendWithAccessToken).toHaveBeenNthCalledWith(
      2,
      'azure',
      delivery,
      delivery.createdBy.session,
      'fresh-token',
      [],
      undefined,
    );
    expect(result).toEqual({ responseStatusCode: 202 });
  });

  it('retries after provider token-expiry messages', async () => {
    const { service, sessionService, sendWithAccessToken } = createTransport();
    const delivery = createDelivery('stale-token');
    sendWithAccessToken
      .mockRejectedValueOnce(
        new Error('Lifetime validation failed, the token is expired.'),
      )
      .mockResolvedValueOnce({ responseStatusCode: 202 });
    sessionService.refreshAccessToken.mockResolvedValue('fresh-token');

    const result = await service.send(delivery as never, [], {} as never);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sendWithAccessToken).toHaveBeenNthCalledWith(
      2,
      'azure',
      delivery,
      delivery.createdBy.session,
      'fresh-token',
      [],
      undefined,
    );
    expect(result).toEqual({ responseStatusCode: 202 });
  });

  it('refreshes before sending when only a refresh token is stored', async () => {
    const { service, sessionService, sendWithAccessToken } = createTransport();
    const delivery = createDelivery();
    sendWithAccessToken.mockResolvedValue({ responseStatusCode: 202 });
    sessionService.refreshAccessToken.mockResolvedValue('fresh-token');

    const result = await service.send(delivery as never, [], {} as never);

    expect(sessionService.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sendWithAccessToken).toHaveBeenCalledWith(
      'azure',
      delivery,
      delivery.createdBy.session,
      'fresh-token',
      [],
      undefined,
    );
    expect(result).toEqual({ responseStatusCode: 202 });
  });

  it('does not retry non-authentication provider failures', async () => {
    const { service, sessionService, sendWithAccessToken } = createTransport();
    const delivery = createDelivery('stale-token');
    const providerError = {
      statusCode: 504,
      body: { error: { code: 'GatewayTimeout' } },
      message: 'Gateway timeout',
    };
    sendWithAccessToken.mockRejectedValue(providerError);
    sessionService.refreshAccessToken.mockResolvedValue('fresh-token');

    await expect(
      service.send(delivery as never, [], {} as never),
    ).rejects.toEqual(providerError);
    expect(sessionService.refreshAccessToken).not.toHaveBeenCalled();
    expect(sendWithAccessToken).toHaveBeenCalledTimes(1);
  });
});
