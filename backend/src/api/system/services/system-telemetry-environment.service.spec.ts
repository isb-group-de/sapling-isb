import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';

describe('SystemTelemetryEnvironmentService', () => {
  it('refreshes mutable metadata without changing the stable environment handle', async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const service = new SystemTelemetryEnvironmentService({} as never);

    await service.ensure({ getConnection: () => ({ execute }) } as never);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('"kind" = excluded."kind"'),
      expect.arrayContaining([service.currentId, service.currentKind]),
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('on conflict ("handle")'),
      expect.any(Array),
    );
  });
});
