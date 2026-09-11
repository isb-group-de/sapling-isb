import { AuthenticationTelemetryService } from './authentication-telemetry.service';

describe('AuthenticationTelemetryService', () => {
  it('attributes a failed local login when its login name belongs to a person', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([{ handle: 4810 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new AuthenticationTelemetryService({
      fork: () => ({ getConnection: () => ({ execute }) }),
    } as never);

    await service.record('loginFailure', 'local', null, 'known-login-name');

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[0]?.[0]).toContain('"login_name" = ?');
    expect(execute.mock.calls[2]?.[1]).toEqual(
      expect.arrayContaining([4810, 'loginFailure', 'local']),
    );
  });

  it('keeps unknown failed login names anonymous', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new AuthenticationTelemetryService({
      fork: () => ({ getConnection: () => ({ execute }) }),
    } as never);

    await service.record('loginFailure', 'local', null, 'unknown-login-name');

    expect(execute.mock.calls[2]?.[1]).toEqual(
      expect.arrayContaining([null, 'loginFailure', 'local']),
    );
  });
});
