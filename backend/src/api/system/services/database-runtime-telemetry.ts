import { EntityManager } from '@mikro-orm/core';
import { performance } from 'perf_hooks';
import type { NumericMetric } from './system-telemetry-persistence';

export async function collectDatabaseRuntimeMetrics(
  em: EntityManager,
): Promise<NumericMetric[]> {
  const startedAt = performance.now();
  const rows = (await em
    .fork()
    .getConnection()
    .execute(
      `select (select count(*) from pg_locks where not granted)::int as "waitingLocks",
       coalesce(sum("deadlocks"), 0)::bigint as "deadlocks",
       coalesce(sum("xact_rollback"), 0)::bigint as "rollbacks"
     from pg_stat_database where "datname" = current_database()`,
    )) as Array<{
    waitingLocks: number;
    deadlocks: number;
    rollbacks: number;
  }>;
  return [
    minuteMetric('database.probeLatencyMs', performance.now() - startedAt),
    minuteMetric('database.waitingLocks', Number(rows[0]?.waitingLocks ?? 0)),
    minuteMetric('database.deadlocksTotal', Number(rows[0]?.deadlocks ?? 0)),
    minuteMetric('database.rollbacksTotal', Number(rows[0]?.rollbacks ?? 0)),
  ];
}

function minuteMetric(key: string, value: number): NumericMetric {
  return { key, value, resolution: '1m' };
}
