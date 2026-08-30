import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SYSTEM_TELEMETRY_ENABLED } from '../../../constants/project.constants';

const ADVISORY_LOCK_ID = 7_324_905_191;

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
      const lock = await em
        .getConnection()
        .execute(`select pg_try_advisory_lock(?) as "locked"`, [
          ADVISORY_LOCK_ID,
        ]);
      if (lock[0]?.locked !== true) return;
      await this.rollupSystem(em, '10s', '1m', '1 minute');
      await this.rollupSystem(em, '1m', '15m', '15 minutes');
      await this.rollupSystem(em, '15m', '1h', '1 hour');
      await this.rollupHttp(em, '1m', '15m', '15 minutes');
      await this.rollupHttp(em, '15m', '1h', '1 hour');
      await this.purge(em);
    } catch (error) {
      global.log?.error?.('system telemetry retention failed', error);
    } finally {
      try {
        await em
          .getConnection()
          .execute(`select pg_advisory_unlock(?)`, [ADVISORY_LOCK_ID]);
      } catch {
        // The connection may already be unavailable; PostgreSQL releases session locks.
      }
      this.running = false;
    }
  }

  private async rollupSystem(
    em: EntityManager,
    source: string,
    target: string,
    interval: string,
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
      from "system_metric_bucket_item" where "resolution" = ?
      group by "instance_handle", date_bin(interval '${interval}', "bucket_start", timestamp '2000-01-01'),
        "metric_key", "dimension_key"
      on conflict ("instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key")
      do update set "sample_count" = excluded."sample_count", "minimum" = excluded."minimum",
        "maximum" = excluded."maximum", "sum" = excluded."sum", "last" = excluded."last"`,
      [target, source],
    );
  }

  private async rollupHttp(
    em: EntityManager,
    source: string,
    target: string,
    interval: string,
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
      from "http_metric_bucket_item" where "resolution" = ?
      group by date_bin(interval '${interval}', "bucket_start", timestamp '2000-01-01'),
        "attribution_key", "auth_kind", "route_group"
      on conflict ("bucket_start", "resolution", "attribution_key", "route_group", "auth_kind")
      do update set "person_handle" = excluded."person_handle", "api_token_handle" = excluded."api_token_handle",
        "request_count" = excluded."request_count", "client_error_count" = excluded."client_error_count",
        "server_error_count" = excluded."server_error_count", "request_bytes" = excluded."request_bytes",
        "response_bytes" = excluded."response_bytes", "duration_sum_ms" = excluded."duration_sum_ms",
        "duration_max_ms" = excluded."duration_max_ms", "duration_histogram" = excluded."duration_histogram",
        "impersonated_count" = excluded."impersonated_count"`,
      [target, source],
    );
  }

  private async purge(em: EntityManager) {
    const statements = [
      boundedDelete(
        'system_metric_bucket_item',
        `"resolution" = '10s' and "bucket_start" < now() - interval '48 hours'`,
      ),
      boundedDelete(
        'system_metric_bucket_item',
        `"resolution" = '1m' and "bucket_start" < now() - interval '7 days'`,
      ),
      boundedDelete(
        'system_metric_bucket_item',
        `"resolution" = '15m' and "bucket_start" < now() - interval '30 days'`,
      ),
      boundedDelete(
        'system_metric_bucket_item',
        `"resolution" = '1h' and "bucket_start" < now() - interval '90 days'`,
      ),
      boundedDelete(
        'http_metric_bucket_item',
        `"resolution" = '1m' and "bucket_start" < now() - interval '7 days'`,
      ),
      boundedDelete(
        'http_metric_bucket_item',
        `"resolution" = '15m' and "bucket_start" < now() - interval '30 days'`,
      ),
      boundedDelete(
        'http_metric_bucket_item',
        `"resolution" = '1h' and "bucket_start" < now() - interval '90 days'`,
      ),
      boundedDelete(
        'ai_usage_event_item',
        `"occurred_at" < now() - interval '90 days'`,
      ),
      boundedDelete(
        'authentication_event_item',
        `"occurred_at" < now() - interval '90 days'`,
      ),
      boundedDelete(
        'system_alert_incident_item',
        `"state" = 'resolved' and "resolved_at" < now() - interval '90 days'`,
      ),
    ];
    for (const statement of statements) {
      await em.getConnection().execute(statement);
    }
  }
}

function boundedDelete(table: string, condition: string): string {
  return `delete from "${table}" where "handle" in (
    select "handle" from "${table}" where ${condition}
    order by "handle" asc limit 5000
  )`;
}
