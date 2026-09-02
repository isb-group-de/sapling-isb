import { SystemTelemetryCollectorService } from './system-telemetry-collector.service';

describe('SystemTelemetryCollectorService', () => {
  function createService() {
    const execute = jest.fn().mockResolvedValue([]);
    const em = { getConnection: () => ({ execute }) };
    const service = new SystemTelemetryCollectorService(
      { fork: () => em } as never,
      {} as never,
      {} as never,
      { getVersion: () => ({ version: '1.2.3' }) },
      {} as never,
      { getIgnoredFilesystemDimensions: () => [] } as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
      { getStatus: () => ({ activeRequests: 0, activeStreams: 0 }) } as never,
    );
    return { execute, service };
  }

  it('persists the instance heartbeat and all native-resolution metrics atomically', async () => {
    const { execute, service } = createService();
    const persistSample = Reflect.get(service, 'persistSample') as (
      now: Date,
      metrics: Array<{
        key: string;
        value: number;
        resolution?: '10s' | '1m' | '15m';
      }>,
    ) => Promise<void>;

    await persistSample.call(service, new Date('2026-09-02T12:34:56.000Z'), [
      { key: 'process.cpu.percent', value: 2 },
      { key: 'host.memory.usedPercent', value: 25, resolution: '1m' },
      { key: 'database.sizeBytes', value: 100, resolution: '15m' },
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    const calls = execute.mock.calls as unknown as Array<[string, unknown[]]>;
    expect(calls[0]?.[0]).toContain('with upserted_instance as');
    const metrics = JSON.parse(calls[0]?.[1]?.[8] as string) as Array<{
      resolution: string;
      bucketStart: string;
    }>;
    expect(metrics.map((metric) => metric.resolution)).toEqual([
      '10s',
      '1m',
      '15m',
    ]);
    expect(metrics.map((metric) => metric.bucketStart)).toEqual([
      '2026-09-02T12:34:50.000Z',
      '2026-09-02T12:34:00.000Z',
      '2026-09-02T12:30:00.000Z',
    ]);
  });

  it('marks its instance as gracefully stopped during application shutdown', async () => {
    const { execute, service } = createService();

    await service.onApplicationShutdown();

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining(`"lifecycle_reason" = 'gracefulShutdown'`),
      [service.instanceId],
    );
  });
});
