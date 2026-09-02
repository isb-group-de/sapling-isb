import { SystemCheckService } from './system-check.service';

describe('SystemCheckService', () => {
  it('serializes checks per environment and completes the canary lifecycle', async () => {
    const execute = jest.fn((sql: string, parameters: unknown[] = []) => {
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve([{ locked: true }]);
      }
      if (sql.includes('select "marker"')) {
        return Promise.resolve([{ marker: parameters[0] }]);
      }
      if (sql.includes('from "http_metric_bucket_item"')) {
        return Promise.resolve([{ total: 100, errors: 0, timeouts: 0 }]);
      }
      if (sql.includes('from "system_metric_bucket_item"')) {
        if (sql.includes("interval '15 minutes'")) {
          return Promise.resolve([
            {
              metricKey: 'web.lcpMs',
              value: 1200,
              sampleCount: 4,
              capturedAt: new Date(),
            },
          ]);
        }
        return Promise.resolve([
          { metricKey: 'queue.oldestWaitingSeconds', value: 0 },
        ]);
      }
      if (sql.includes('from "ai_usage_event_item"')) {
        return Promise.resolve([{ total: 0, errors: 0 }]);
      }
      if (sql.includes('from "system_error_occurrence_item"')) {
        return Promise.resolve([{ errors: 0 }]);
      }
      return Promise.resolve([]);
    });
    const em = {
      getConnection: () => ({ execute }),
      transactional: (callback: (transaction: unknown) => unknown) =>
        callback(em),
    };
    const service = new SystemCheckService(
      { fork: () => em } as never,
      {
        getStatus: () => ({ lastSampleAt: new Date().toISOString() }),
      } as never,
      {
        currentId: 'test',
        currentKind: 'test',
        isExplicitlyConfigured: true,
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const results = await service.runAll();

    expect(results).toHaveLength(10);
    expect(results.every((result) => result.status === 'healthy')).toBe(true);
    expect(results).toContainEqual(
      expect.objectContaining({
        checkKey: 'queue.flow',
        status: 'healthy',
        summary: '0s oldest · 0 recent failures',
      }),
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_xact_lock'),
      ['system-checks:test'],
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('insert into "system_canary_record_item"'),
      [expect.stringMatching(/^canary-/)],
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('delete from "system_canary_record_item"'),
      [expect.stringMatching(/^canary-/)],
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining(`"status" = 'failed'`),
      ['test'],
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('max("maximum")'),
      ['test'],
    );
    expect(results).toContainEqual(
      expect.objectContaining({
        checkKey: 'telemetry.configuration',
        status: 'healthy',
      }),
    );
  });

  it('reports missing LCP data as unknown instead of a zero-value success', async () => {
    const execute = jest.fn((sql: string) => {
      if (sql.includes('pg_try_advisory_xact_lock'))
        return Promise.resolve([{ locked: true }]);
      if (sql.includes('select "marker"')) return Promise.resolve([]);
      if (sql.includes('from "http_metric_bucket_item"'))
        return Promise.resolve([{ total: 0, errors: 0, timeouts: 0 }]);
      if (sql.includes('from "ai_usage_event_item"'))
        return Promise.resolve([{ total: 0, errors: 0 }]);
      if (sql.includes('from "system_error_occurrence_item"'))
        return Promise.resolve([{ errors: 0 }]);
      return Promise.resolve([]);
    });
    const em = {
      getConnection: () => ({ execute }),
      transactional: (callback: (transaction: unknown) => unknown) =>
        callback(em),
    };
    const service = new SystemCheckService(
      { fork: () => em } as never,
      {
        getStatus: () => ({ lastSampleAt: new Date().toISOString() }),
      } as never,
      {
        currentId: 'host:production',
        currentKind: 'production',
        isExplicitlyConfigured: false,
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const results = await service.runAll();

    const frontendResult = results.find(
      (result) => result.checkKey === 'frontend.experience',
    );
    expect(frontendResult).toMatchObject({ status: 'unknown' });
    expect(frontendResult?.summary).toContain('LCP n/a');
    expect(results).toContainEqual(
      expect.objectContaining({
        checkKey: 'telemetry.configuration',
        status: 'warning',
      }),
    );
    expect(JSON.stringify(execute.mock.calls)).toContain(
      "interval '15 minutes'",
    );
  });
});
