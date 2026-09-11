import { AuthenticationTelemetryService } from './authentication-telemetry.service';

describe('AuthenticationTelemetryService', () => {
  it('attributes a failed local login when its login name belongs to a person', async () => {
    const execute = jest
      .fn<Promise<unknown[]>, [string, unknown[]?]>()
      .mockResolvedValueOnce([{ handle: 4810 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new AuthenticationTelemetryService({
      fork: () => ({ getConnection: () => ({ execute }) }),
    } as never);

    await service.record('loginFailure', 'local', null, 'known-login-name');

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"login_name" = ?') as unknown,
      ['known-login-name'],
    );
    expect(execute).toHaveBeenNthCalledWith(
      3,
      expect.any(String) as unknown,
      expect.arrayContaining([4810, 'loginFailure', 'local']) as unknown,
    );
  });

  it('keeps unknown failed login names anonymous', async () => {
    const execute = jest
      .fn<Promise<unknown[]>, [string, unknown[]?]>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new AuthenticationTelemetryService({
      fork: () => ({ getConnection: () => ({ execute }) }),
    } as never);

    await service.record('loginFailure', 'local', null, 'unknown-login-name');

    expect(execute).toHaveBeenNthCalledWith(
      3,
      expect.any(String) as unknown,
      expect.arrayContaining([null, 'loginFailure', 'local']) as unknown,
    );
  });
});
