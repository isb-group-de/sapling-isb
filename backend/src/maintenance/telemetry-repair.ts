import {
  buildTelemetryRollup,
  type Rollup,
} from '../api/system/services/system-telemetry-rollup.sql';

// Only collector-owned native resolutions are eligible. Unknown metrics and
// sparse browser samples cannot establish complete coverage and are reported.
export const NATIVE_TELEMETRY_KEYS = {
  '10s': [
    'host.cpu.percent',
    'host.cpu.systemPercent',
    'host.cpu.userPercent',
    'host.load.1m',
    'host.load.5m',
    'host.load.15m',
    'process.memory.rssBytes',
    'process.memory.heapUsedBytes',
    'process.memory.heapTotalBytes',
    'process.memory.externalBytes',
    'process.cpu.percent',
    'process.eventLoop.p95Ms',
    'process.uptimeSeconds',
    'process.startedAtEpochMs',
    'http.activeRequests',
    'http.activeStreams',
    'network.rxBytesPerSecond',
    'network.txBytesPerSecond',
    'telemetry.spool.overflow',
  ],
  '1m': [
    'host.memory.totalBytes',
    'host.memory.usedBytes',
    'host.memory.usedPercent',
    'host.memory.availableBytes',
    'host.swap.usedBytes',
    'host.swap.usedPercent',
    'network.rxErrors',
    'network.txErrors',
    'network.rxDropped',
    'network.txDropped',
    'process.gc.count',
    'process.gc.pauseTotalMs',
    'process.gc.pauseMaxMs',
    'filesystem.usedPercent',
    'filesystem.usedBytes',
    'filesystem.sizeBytes',
    'database.activeConnections',
    'database.maxConnections',
    'database.connectionUsedPercent',
    'database.probeLatencyMs',
    'database.waitingLocks',
    'database.deadlocksTotal',
    'database.rollbacksTotal',
    'queue.waiting',
    'queue.active',
    'queue.failed',
    'queue.delayed',
    'queue.paused',
    'queue.connectionLatencyMs',
    'queue.oldestWaitingSeconds',
  ],
  '15m': [
    'database.sizeBytes',
    'documentStorage.sizeBytes',
    'documentStorage.fileCount',
  ],
} as const;

export type TelemetryRepairOptions = {
  environment: string;
  from: Date;
  to: Date;
  apply: boolean;
};
export type RepairQuery = (
  sql: string,
  params: readonly unknown[],
) => Promise<Array<Record<string, unknown>>>;

export function parseTelemetryRepairArgs(
  args: string[],
): TelemetryRepairOptions {
  const values = new Map<string, string>();
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === '--apply' && !apply) {
      apply = true;
      continue;
    }
    if (!['--environment', '--from', '--to'].includes(key) || values.has(key)) {
      throw new Error(`Unknown or duplicate argument: ${key}`);
    }
    const value = args[++index];
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${key}`);
    values.set(key, value);
  }
  const environment = values.get('--environment')?.trim();
  const fromText = values.get('--from') ?? '';
  const toText = values.get('--to') ?? '';
  const from = new Date(fromText);
  const to = new Date(toText);
  if (
    !environment ||
    ![fromText, toText].every((value) =>
      /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value),
    ) ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to ||
    to.getTime() - from.getTime() > 90 * 24 * 60 * 60_000
  ) {
    throw new Error(
      'Required: --environment ID --from ISO_TIMESTAMP --to ISO_TIMESTAMP (explicit time zones, increasing range, at most 90 days). Add --apply to write.',
    );
  }
  return { environment, from, to, apply };
}

export async function repairTelemetry(
  query: RepairQuery,
  options: TelemetryRepairOptions,
  now: Date,
) {
  const environments = await query(
    'select handle from system_telemetry_environment_item where handle = ?',
    [options.environment],
  );
  if (environments.length !== 1)
    throw new Error('Telemetry environment does not exist.');
  if (options.to > now)
    throw new Error('The repair range must not extend into the future.');
  const definitions: Rollup[] = [];
  for (const [target, minutes] of [
    ['1m', 1],
    ['15m', 15],
    ['1h', 60],
  ] as const) {
    for (const [source, sourceMinutes, retentionHours] of [
      ['10s', 1 / 6, 48],
      ['1m', 1, 168],
      ['15m', 15, 720],
    ] as const) {
      if (sourceMinutes < minutes)
        definitions.push({
          kind: 'system',
          source,
          target,
          minutes,
          retentionHours,
        });
    }
    if (minutes > 1)
      definitions.push({
        kind: 'http',
        source: '1m',
        target,
        minutes,
        retentionHours: 168,
      });
  }
  const report: Array<Record<string, unknown>> = [];
  for (const definition of definitions) {
    const statements = buildTelemetryRollup(definition, {
      now,
      repair: {
        ...options,
        metricKeys:
          definition.kind === 'system'
            ? [...NATIVE_TELEMETRY_KEYS[definition.source]]
            : undefined,
      },
    });
    const [preview] = await query(statements.preview, statements.params);
    let written = 0;
    if (options.apply && Number(preview?.changes) > 0) {
      written = (await query(statements.upsert, statements.params)).length;
    }
    report.push({
      kind: definition.kind,
      source: definition.source,
      target: definition.target,
      ...preview,
      written,
    });
  }
  const unsupported = await query(
    `select metric_key, resolution, count(*)::int as buckets
    from system_metric_bucket_item b join system_telemetry_instance_item i on i.handle = b.instance_handle
    where i.environment_handle = ? and b.bucket_start >= ? and b.bucket_start < ?
      and b.resolution in ('1m', '15m', '1h') and b.metric_key not in (select jsonb_array_elements_text(?::jsonb))
    group by metric_key, resolution order by metric_key, resolution`,
    [
      options.environment,
      options.from.toISOString(),
      options.to.toISOString(),
      JSON.stringify(Object.values(NATIVE_TELEMETRY_KEYS).flat()),
    ],
  );
  return {
    mode: options.apply ? 'apply' : 'preview',
    environment: options.environment,
    from: options.from.toISOString(),
    to: options.to.toISOString(),
    asOf: now.toISOString(),
    report,
    unsupported,
    completeness:
      'System repairs require every native time slot with sample_count=1. HTTP repairs use only retained original minute buckets; absent HTTP buckets mean no recorded requests, not proof of availability. Missing or unsupported source evidence is not reconstructed.',
  };
}
