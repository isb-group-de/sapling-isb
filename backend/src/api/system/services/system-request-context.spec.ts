import {
  createSystemRequestContextMiddleware,
  getSystemRequestContext,
  type SystemRequestContext,
} from './system-request-context';

describe('system request context middleware', () => {
  it('preserves valid correlation IDs and exposes them before downstream work', () => {
    const response = { setHeader: jest.fn() };
    const request = {
      header: (name: string) =>
        name === 'x-correlation-id' ? 'correlation-12345678' : undefined,
    };
    let observed: SystemRequestContext | undefined;

    createSystemRequestContextMiddleware()(
      request as never,
      response as never,
      () => {
        observed = getSystemRequestContext();
      },
    );

    expect(observed).toMatchObject({ correlationId: 'correlation-12345678' });
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      'correlation-12345678',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.stringMatching(/^[a-f0-9-]{36}$/),
    );
  });
});
