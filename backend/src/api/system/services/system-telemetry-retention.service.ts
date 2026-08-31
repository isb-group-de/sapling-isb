import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PostgreSqlConnection } from '@mikro-orm/postgresql';
import { SYSTEM_TELEMETRY_ENABLED } from '../../../constants/project.constants';

const ADVISORY_LOCK_ID = 7_324_905_191;
const PURGE_BATCH_SIZE = 5_000;
const MAX_PURGE_BATCHES = 100;

@Injectable()
export class SystemTelemetryRetentionService
  implements OnModuleInit, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly em: EntityManager) {}

  onModuleInit(): void {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    this.startupTimer = setTimeout(() => void this.runMaintenance(), 120_000);
    this.startupTimer.unref();
    this.timer = setInterval(() => void this.runMaintenance(), 60 * 60_000);
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
                  builder.val(ADVISORY_LOCK_ID),
                ])
                .as('locked'),
            )
            .executeTakeFirst();
          if (lock?.locked !== true) return;
          try {
            await this.rollupSystem(em, '10s', '1m', '1 minute', '48 hours');
            await this.rollupSystem(em, '1m', '15m', '15 minutes', '7 days');
            await this.rollupSystem(em, '15m', '1h', '1 hour', '30 days');
            await this.rollupHttp(em, '1m', '15m', '15 minutes', '7 days');
            await this.rollupHttp(em, '15m', '1h', '1 hour', '30 days');
            await this.purge(em);
          } finally {
            await lockConnection
              .selectNoFrom((builder) =>
                builder
                  .fn<boolean>('pg_advisory_unlock', [
                    builder.val(ADVISORY_LOCK_ID),
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

  private async rollupSystem(
    em: EntityManager,
    source: string,
    target: string,
    interval: string,
    sourceRetention: string,
  ) {
    await em.getConnection().execute(
      `insert into "system_metric_bucket_item" (
        "instance_handle", "bucket_start", "resolution", "metric_key",
        "dimension_key", "sample_count", "minimum", "maximum", "sum", "last", "created_at"
      )
      select "instance_handle", date_bin(interval '${interval}', "bucket_start", timestamp '2000-01-01'),
        ?, "metric_key", "dimension_key", sum("sample_count")::int,
        min("minimum"), max("maximum"), sum("sum"),
        (array_agg("last" order by "bucket_start" desc))[1], now()
      from "system_metric_bucket_item" source where source."resolution" = ?
        and source."bucket_start" >= now() - interval '${sourceRetention}'
        and source."bucket_start" < date_bin(interval '${interval}', now(), timestamp '2000-01-01')
        and (
          source."bucket_start" >= now() - interval '2 hours'
          or not exists (
            select 1 from "system_metric_bucket_item" target_bucket
            where target_bucket."resolution" = ?
              and target_bucket."instance_handle" = source."instance_handle"
              and target_bucket."bucket_start" = date_bin(
                interval '${interval}', source."bucket_start", timestamp '2000-01-01'
              )
              and target_bucket."metric_key" = source."metric_key"
              and target_bucket."dimension_key" = source."dimension_key"
          )
        )
      group by source."instance_handle", date_bin(interval '${interval}', source."bucket_start", timestamp '2000-01-01'),
        source."metric_key", source."dimension_key"
      on conflict ("instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key")
      do update set "sample_count" = excluded."sample_count", "minimum" = excluded."minimum",
        "maximum" = excluded."maximum", "sum" = excluded."sum", "last" = excluded."last"`,
      [target, source, target],
    );
  }

  private async rollupHttp(
    em: EntityManager,
    source: string,
    target: string,
    interval: string,
    sourceRetention: string,
  ) {
    const histogramExpressions = Array.from(
      { length: 10 },
      (_, index) => `sum(coalesce(("duration_histogram"->>${index})::int, 0))`,
    ).join(', ');
    await em.getConnection().execute(
      `insert into "http_metric_bucket_item" (
        "bucket_start", "resolution", "attribution_key", "person_handle", "api_token_handle",
        "auth_kind", "route_group", "request_count", "client_error_count", "server_error_count",
        "request_bytes", "response_bytes", "duration_sum_ms", "duration_max_ms",
        "duration_histogram", "impersonated_count", "created_at"
      )
      select date_bin(interval '${interval}', "bucket_start", timestamp '2000-01-01'), ?,
        "attribution_key", max("person_handle"), max("api_token_handle"), "auth_kind", "route_group",
        sum("request_count")::int, sum("client_error_count")::int, sum("server_error_count")::int,
        sum("request_bytes"), sum("response_bytes"), sum("duration_sum_ms"), max("duration_max_ms"),
        jsonb_build_array(${histogramExpressions}), sum("impersonated_count")::int, now()
      from "http_metric_bucket_item" source where source."resolution" = ?
        and source."bucket_start" >= now() - interval '${sourceRetention}'
        and source."bucket_start" < date_bin(interval '${interval}', now(), timestamp '2000-01-01')
        and (
          source."bucket_start" >= now() - interval '2 hours'
          or not exists (
            select 1 from "http_metric_bucket_item" target_bucket
            where target_bucket."resolution" = ?
              and target_bucket."bucket_start" = date_bin(
                interval '${interval}', source."bucket_start", timestamp '2000-01-01'
              )
              and target_bucket."attribution_key" = source."attribution_key"
              and target_bucket."route_group" = source."route_group"
              and target_bucket."auth_kind" = source."auth_kind"
          )
        )
      group by date_bin(interval '${interval}', source."bucket_start", timestamp '2000-01-01'),
        source."attribution_key", source."auth_kind", source."route_group"
      on conflict ("bucket_start", "resolution", "attribution_key", "route_group", "auth_kind")
      do update set "person_handle" = excluded."person_handle", "api_token_handle" = excluded."api_token_handle",
        "request_count" = excluded."request_count", "client_error_count" = excluded."client_error_count",
        "server_error_count" = excluded."server_error_count", "request_bytes" = excluded."request_bytes",
        "response_bytes" = excluded."response_bytes", "duration_sum_ms" = excluded."duration_sum_ms",
        "duration_max_ms" = excluded."duration_max_ms", "duration_histogram" = excluded."duration_histogram",
        "impersonated_count" = excluded."impersonated_count"`,
      [target, source, target],
    );
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
      const rows = await em
        .getConnection()
        .execute(boundedDelete(table, condition), [PURGE_BATCH_SIZE]);
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
