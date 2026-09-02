import { EntityManager } from '@mikro-orm/core';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';

export type MetricResolution = '10s' | '1m' | '15m';

export type NumericMetric = {
  key: string;
  value: number;
  dimension?: string;
  resolution?: MetricResolution;
};

type PersistSystemTelemetrySampleInput = {
  em: EntityManager;
  environment: SystemTelemetryEnvironmentService;
  instanceId: string;
  processSlot: string;
  bootId: string;
  hostname: string;
  version: string | null;
  processStartedAt: Date;
  capturedAt: Date;
  metrics: NumericMetric[];
};

export async function persistSystemTelemetrySample(
  input: PersistSystemTelemetrySampleInput,
): Promise<void> {
  const em = input.em.fork();
  await input.environment.ensure(em);
  const metricRows = input.metrics.map((metric) => {
    const resolution = metric.resolution ?? '10s';
    return {
      bucketStart: floorDate(
        input.capturedAt,
        resolutionMilliseconds(resolution),
      ),
      resolution,
      metricKey: metric.key,
      dimensionKey: metric.dimension ?? '',
      value: metric.value,
    };
  });
  await em.getConnection().execute(
    `with upserted_instance as (
      insert into "system_telemetry_instance_item" (
        "handle", "environment_handle", "process_slot", "boot_id", "hostname", "app_version", "process_started_at",
        "last_sample_at", "collector_enabled", "status", "created_at", "updated_at"
      ) values (?, ?, ?, ?, ?, ?, ?, ?, true, 'active', now(), now())
      on conflict ("handle") do update set
        "hostname" = excluded."hostname", "app_version" = excluded."app_version",
        "process_started_at" = excluded."process_started_at",
        "last_sample_at" = excluded."last_sample_at", "collector_enabled" = true,
        "status" = 'active', "updated_at" = now()
      returning "handle"
    ), metrics as (
      select * from jsonb_to_recordset(cast(? as jsonb)) as metric(
        "bucketStart" timestamptz, "resolution" varchar, "metricKey" varchar,
        "dimensionKey" varchar, "value" float8
      )
    )
    insert into "system_metric_bucket_item" (
      "instance_handle", "bucket_start", "resolution", "metric_key",
      "dimension_key", "sample_count", "minimum", "maximum", "sum", "last", "created_at"
    ) select upserted_instance."handle", metrics."bucketStart", metrics."resolution",
      metrics."metricKey", metrics."dimensionKey", 1, metrics."value", metrics."value",
      metrics."value", metrics."value", now()
    from upserted_instance cross join metrics
    on conflict ("instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key")
    do update set "sample_count" = 1, "minimum" = excluded."minimum",
      "maximum" = excluded."maximum", "sum" = excluded."sum", "last" = excluded."last"`,
    [
      input.instanceId,
      input.environment.currentId,
      input.processSlot,
      input.bootId,
      input.hostname,
      input.version,
      input.processStartedAt,
      input.capturedAt,
      JSON.stringify(metricRows),
    ],
  );
}

function floorDate(date: Date, intervalMs: number): Date {
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

function resolutionMilliseconds(resolution: MetricResolution): number {
  if (resolution === '15m') return 15 * 60_000;
  if (resolution === '1m') return 60_000;
  return 10_000;
}
