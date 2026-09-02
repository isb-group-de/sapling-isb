import { BadRequestException } from '@nestjs/common';
import {
  resolveRange,
  runWithConcurrency,
  SystemMonitoringQueryService,
} from './system-monitoring-query.service';

describe('monitoring query ranges', () => {
  it('accepts a valid UTC range', () => {
    const range = resolveRange({
      from: '2026-08-29T00:00:00.000Z',
      to: '2026-08-30T00:00:00.000Z',
    });
    expect(range.to.getTime() - range.from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('rejects reversed and over-90-day ranges', () => {
    expect(() =>
      resolveRange({
        from: '2026-08-30T00:00:00.000Z',
        to: '2026-08-29T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRange({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-08-30T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('expands multiple metric keys as an SQL IN list', async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const service = new SystemMonitoringQueryService(
      { fork: () => ({ getConnection: () => ({ execute }) }) } as never,
      { getStatus: () => ({ lastSampleAt: null }) } as never,
      { getStatus: () => ({}) } as never,
      { currentId: 'test' } as never,
    );
    const metrics = ['host.cpu.percent', 'host.memory.usedPercent'];

    const result = await service.getSeries({
      metrics,
      resolution: 'auto',
      from: '2026-08-29T00:00:00.000Z',
      to: '2026-08-30T00:00:00.000Z',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('"metric_key" in (?)'),
      expect.arrayContaining([metrics]),
    );
    expect(result.resolution).toBe('1m');
    const calls = execute.mock.calls as unknown as Array<[string, unknown[]]>;
    expect(calls[0]?.[0]).toContain('choices as');
  });

  it('lists only users with interactive activity in the selected range', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    const service = new SystemMonitoringQueryService(
      { fork: () => ({ getConnection: () => ({ execute }) }) } as never,
      { getStatus: () => ({ lastSampleAt: null }) } as never,
      { getStatus: () => ({}) } as never,
      { currentId: 'test' } as never,
    );

    await service.getUsers({
      page: 1,
      limit: 25,
      sort: 'activity',
      from: '2026-08-29T00:00:00.000Z',
      to: '2026-08-30T00:00:00.000Z',
    });

    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`presence."auth_kind" = 'session'`),
      expect.any(Array),
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`presence_auth."event_type" = 'loginSuccess'`),
      expect.any(Array),
    );
  });

  it('returns the request volume over time alongside the route analysis', async () => {
    const requestSeries = [
      {
        metricKey: 'http.requestCount',
        dimensionKey: '',
        capturedAt: new Date('2026-08-29T12:00:00.000Z'),
        last: 12,
      },
    ];
    const execute = jest
      .fn()
      .mockResolvedValueOnce([
        {
          group: 'api',
          requestCount: 12,
          durationHistogram: [12, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      ])
      .mockResolvedValueOnce(requestSeries);
    const service = new SystemMonitoringQueryService(
      { fork: () => ({ getConnection: () => ({ execute }) }) } as never,
      { getStatus: () => ({ lastSampleAt: null }) } as never,
      { getStatus: () => ({}) } as never,
      { currentId: 'test' } as never,
    );

    const result = await service.getRequests({
      groupBy: 'route',
      requestKind: 'standard',
      from: '2026-08-29T11:00:00.000Z',
      to: '2026-08-29T13:00:00.000Z',
    });

    expect(result.series).toEqual(requestSeries);
    expect(result.groups[0]).toMatchObject({
      group: 'api',
      requestCount: 12,
    });
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('group by "bucket_start"'),
      expect.arrayContaining(['1m']),
    );
  });

  it('groups standard request telemetry by bounded resources', async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const service = new SystemMonitoringQueryService(
      { fork: () => ({ getConnection: () => ({ execute }) }) } as never,
      { getStatus: () => ({ lastSampleAt: null }) } as never,
      { getStatus: () => ({}) } as never,
      { currentId: 'test' } as never,
    );

    await service.getRequests({
      groupBy: 'resource',
      requestKind: 'standard',
      from: '2026-08-29T11:00:00.000Z',
      to: '2026-08-29T13:00:00.000Z',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining(`nullif("resource_key", '')`),
      expect.arrayContaining(['standard']),
    );
  });

  it('limits concurrent monitoring database work while preserving result order', async () => {
    let active = 0;
    let maximumActive = 0;
    const tasks = [0, 1, 2, 3, 4].map((value) => async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return value;
    });

    await expect(runWithConcurrency(tasks, 2)).resolves.toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(maximumActive).toBe(2);
  });
});
