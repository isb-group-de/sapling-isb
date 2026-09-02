import { EntityManager } from '@mikro-orm/core';
import { executeRows, type SqlRow } from './sql-query.utils';
import type { MonitoringRange } from './system-monitoring-query.utils';

export async function loadLatestCheckStatuses(
  em: EntityManager,
  environmentId: string,
  range: MonitoringRange,
): Promise<SqlRow[]> {
  return executeRows(
    em,
    `select distinct on ("check_key") "check_key" as "checkKey", "status"
     from "system_check_run_item"
     where "environment_handle" = ? and "completed_at" between ? and ?
     order by "check_key", "completed_at" desc`,
    [environmentId, range.from, range.to],
  );
}

export function toCheckStatuses(rows: SqlRow[]): string[] {
  return rows.map((row) =>
    typeof row.status === 'string' ? row.status : 'unknown',
  );
}
