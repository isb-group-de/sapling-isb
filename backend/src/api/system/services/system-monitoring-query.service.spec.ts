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
    );
    const metrics = ['host.cpu.percent', 'host.memory.usedPercent'];

    await service.getSeries({
      metrics,
      resolution: 'auto',
      from: '2026-08-29T00:00:00.000Z',
      to: '2026-08-30T00:00:00.000Z',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('"metric_key" in (?)'),
      expect.arrayContaining([metrics]),
    );
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
