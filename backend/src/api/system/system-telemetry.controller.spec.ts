import { SystemTelemetryController } from './system-telemetry.controller';

describe('SystemTelemetryController', () => {
  it('writes up to twenty client metrics with one batch upsert', async () => {
    const execute = jest.fn().mockResolvedValue([{ handle: 1 }, { handle: 2 }]);
    const em = { getConnection: () => ({ execute }) };
    const controller = new SystemTelemetryController(
      {} as never,
      { fork: () => em } as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    const metrics = [
      { metricKey: 'web.lcpMs' as const, value: 1200, page: 'table/person' },
      { metricKey: 'web.cls' as const, value: 0.01, page: 'table/person' },
    ];

    await expect(controller.recordClientMetrics({ metrics })).resolves.toEqual({
      accepted: true,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    const calls = execute.mock.calls as unknown as Array<[string, unknown[]]>;
    expect(calls[0]?.[0]).toContain('jsonb_to_recordset');
    expect(JSON.parse(calls[0]?.[1]?.[1] as string)).toEqual(metrics);
  });

  it('keeps the singular metric endpoint compatible', async () => {
    const execute = jest.fn().mockResolvedValue([{ handle: 1 }]);
    const em = { getConnection: () => ({ execute }) };
    const controller = new SystemTelemetryController(
      {} as never,
      { fork: () => em } as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await expect(
      controller.recordClientMetric({
        metricKey: 'web.bootMs',
        value: 250,
        page: 'home',
      }),
    ).resolves.toEqual({ accepted: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
