import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { executeRows } from './sql-query.utils';
import { PostgreSqlConnection } from '@mikro-orm/postgresql';
import { SYSTEM_TELEMETRY_ENABLED } from '../../../constants/project.constants';

import {
  buildTelemetryRollup,
  TELEMETRY_MAINTENANCE_LOCK_ID,
  TELEMETRY_ROLLUPS,
} from './system-telemetry-rollup.sql';
const PURGE_BATCH_SIZE = 5_000;
const MAX_PURGE_BATCHES = 100;

@Injectable()
export class SystemTelemetryRetentionService
  implements OnModuleInit, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;
  private lastPurgeAt = 0;

  constructor(private readonly em: EntityManager) {}

  onModuleInit(): void {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    this.startupTimer = setTimeout(() => void this.runMaintenance(), 60_000);
    this.startupTimer.unref();
    this.timer = setInterval(() => void this.runMaintenance(), 60_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.timer) clearInterval(this.timer);
  }

  async runMaintenance(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const em = this.em.fork();
    try {
      const connection = em.getConnection() as PostgreSqlConnection;
      await connection
        .getClient()
        .connection()
        .execute(async (lockConnection) => {
          const lock = await lockConnection
            .selectNoFrom((builder) =>
              builder
                .fn<boolean>('pg_try_advisory_lock', [
                  builder.val(TELEMETRY_MAINTENANCE_LOCK_ID),
                ])
                .as('locked'),
            )
            .executeTakeFirst();
          if (lock?.locked !== true) return;
          try {
            const now = new Date();
            for (const definition of TELEMETRY_ROLLUPS) {
              const query = buildTelemetryRollup(definition, { now });
              await em.getConnection().execute(query.upsert, query.params);
            }
            if (Date.now() - this.lastPurgeAt >= 60 * 60_000) {
              await this.purge(em);
              this.lastPurgeAt = Date.now();
            }
          } finally {
            await lockConnection
              .selectNoFrom((builder) =>
                builder
                  .fn<boolean>('pg_advisory_unlock', [
                    builder.val(TELEMETRY_MAINTENANCE_LOCK_ID),
                  ])
                  .as('unlocked'),
              )
              .executeTakeFirst();
          }
        });
    } catch (error) {
      global.log?.error?.('system telemetry retention failed', error);
    } finally {
      this.running = false;
    }
  }

  private async purge(em: EntityManager) {
    const targets = [
      [
        'system_metric_bucket_item',
        `"resolution" = '10s' and "bucket_start" < now() - interval '48 hours'`,
      ],
      [
        'system_metric_bucket_item',
        `"resolution" = '1m' and "bucket_start" < now() - interval '7 days'`,
      ],
      [
        'system_metric_bucket_item',
        `"resolution" = '15m' and "bucket_start" < now() - interval '30 days'`,
      ],
      [
        'system_metric_bucket_item',
        `"resolution" = '1h' and "bucket_start" < now() - interval '90 days'`,
      ],
      [
        'http_metric_bucket_item',
        `"resolution" = '1m' and "bucket_start" < now() - interval '7 days'`,
      ],
      [
        'http_metric_bucket_item',
        `"resolution" = '15m' and "bucket_start" < now() - interval '30 days'`,
      ],
      [
        'http_metric_bucket_item',
        `"resolution" = '1h' and "bucket_start" < now() - interval '90 days'`,
      ],
      ['ai_usage_event_item', `"occurred_at" < now() - interval '90 days'`],
      [
        'authentication_event_item',
        `"occurred_at" < now() - interval '90 days'`,
      ],
      [
        'system_alert_incident_item',
        `"state" = 'resolved' and "resolved_at" < now() - interval '90 days'`,
      ],
      [
        'system_error_occurrence_item',
        `"occurred_at" < now() - interval '14 days'`,
      ],
      ['system_check_run_item', `"started_at" < now() - interval '14 days'`],
      [
        'system_error_group_item',
        `"last_seen_at" < now() - interval '90 days'`,
      ],
      [
        'system_remediation_execution_item',
        `"started_at" < now() - interval '90 days'`,
      ],
    ] as const;
    for (const [table, condition] of targets) {
      await this.purgeTarget(em, table, condition);
    }
  }

  private async purgeTarget(
    em: EntityManager,
    table: string,
    condition: string,
  ) {
    for (let batch = 0; batch < MAX_PURGE_BATCHES; batch += 1) {
      const rows = await executeRows(em, boundedDelete(table, condition), [
        PURGE_BATCH_SIZE,
      ]);
      const deletedCount = Number(rows[0]?.deletedCount ?? 0);
      if (deletedCount < PURGE_BATCH_SIZE) return;
      await yieldToEventLoop();
    }
    global.log?.warn?.(
      `system telemetry retention reached the purge batch limit for ${table}`,
    );
  }
}

export function boundedDelete(table: string, condition: string): string {
  return `with candidates as (
    select "handle" from "${table}" where ${condition}
    order by "handle" asc limit ?
  ), deleted as (
    delete from "${table}" target using candidates
    where target."handle" = candidates."handle"
    returning target."handle"
  )
  select count(*)::int as "deletedCount" from deleted`;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
