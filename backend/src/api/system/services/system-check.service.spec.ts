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
        return Promise.resolve([
          { metricKey: 'queue.failed', value: 100 },
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
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const results = await service.runAll();

    expect(results).toHaveLength(9);
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
  });
});
