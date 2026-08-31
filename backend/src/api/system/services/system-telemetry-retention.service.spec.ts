import {
  boundedDelete,
  SystemTelemetryRetentionService,
} from './system-telemetry-retention.service';

describe('SystemTelemetryRetentionService', () => {
  it('rolls up only completed buckets and skips already aggregated history', async () => {
    let firstPurgeBatch = true;
    const execute = jest.fn(async (sql: string) => {
      if (
        firstPurgeBatch &&
        sql.includes(`"resolution" = '10s'`) &&
        sql.includes(`interval '48 hours'`)
      ) {
        firstPurgeBatch = false;
        return [{ deletedCount: 5_000 }];
      }
      if (sql.includes('"deletedCount"')) return [{ deletedCount: 0 }];
      return [];
    });
    const executeLockQuery = jest
      .fn()
      .mockResolvedValueOnce({ locked: true })
      .mockResolvedValueOnce({ unlocked: true });
    const lockConnection = {
      selectNoFrom: jest.fn(() => ({ executeTakeFirst: executeLockQuery })),
    };
    const connection = {
      execute,
      getClient: () => ({
        connection: () => ({
          execute: (callback: (reserved: typeof lockConnection) => unknown) =>
            callback(lockConnection),
        }),
      }),
    };
    const service = new SystemTelemetryRetentionService({
      fork: () => ({ getConnection: () => connection }),
    } as never);

    await service.runMaintenance();

    const rollups = execute.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => sql.startsWith('insert into'));
    expect(rollups).toHaveLength(5);
    expect(rollups[0]).toContain(
      `source."bucket_start" >= now() - interval '48 hours'`,
    );
    expect(rollups[0]).toContain('or not exists');
    expect(rollups[0]).toContain(
      `source."bucket_start" < date_bin(interval '1 minute', now()`,
    );
    const rawBucketPurges = execute.mock.calls.filter(
      ([sql]) =>
        sql.includes(`"resolution" = '10s'`) &&
        sql.includes(`interval '48 hours'`) &&
        sql.includes('"deletedCount"'),
    );
    expect(rawBucketPurges).toHaveLength(2);
    expect(executeLockQuery).toHaveBeenCalledTimes(2);
  });

  it('uses a small candidate set and reports the number of purged rows', () => {
    const sql = boundedDelete(
      'ai_usage_event_item',
      `"occurred_at" < now() - interval '90 days'`,
    );

    expect(sql).toContain('limit ?');
    expect(sql).toContain(
      'delete from "ai_usage_event_item" target using candidates',
    );
    expect(sql).toContain('select count(*)::int as "deletedCount"');
  });
});
