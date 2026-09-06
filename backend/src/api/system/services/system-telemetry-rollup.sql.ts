export const TELEMETRY_MAINTENANCE_LOCK_ID = 7_324_905_191;

export type Rollup = {
  kind: 'system' | 'http';
  source: '10s' | '1m' | '15m';
  target: '1m' | '15m' | '1h';
  minutes: number;
  retentionHours: number;
};

export const TELEMETRY_ROLLUPS: readonly Rollup[] = [
  {
    kind: 'system',
    source: '10s',
    target: '1m',
    minutes: 1,
    retentionHours: 48,
  },
  {
    kind: 'system',
    source: '1m',
    target: '15m',
    minutes: 15,
    retentionHours: 168,
  },
  {
    kind: 'system',
    source: '15m',
    target: '1h',
    minutes: 60,
    retentionHours: 720,
  },
  {
    kind: 'http',
    source: '1m',
    target: '15m',
    minutes: 15,
    retentionHours: 168,
  },
  {
    kind: 'http',
    source: '15m',
    target: '1h',
    minutes: 60,
    retentionHours: 720,
  },
];

const systemDimensions = ['instance_handle', 'metric_key', 'dimension_key'];
const httpDimensions = [
  'environment_handle',
  'attribution_key',
  'auth_kind',
  'route_group',
  'operation',
  'request_kind',
  'resource_key',
];
const q = (column: string) => `"${column}"`;

export type RollupOptions = {
  now: Date;
  // Repair only reads original samples, never another potentially damaged rollup.
  repair?: { environment: string; from: Date; to: Date; metricKeys?: string[] };
};

/** Builds one aggregation used by maintenance, repair, and PostgreSQL regression tests. */
export function buildTelemetryRollup(def: Rollup, options: RollupOptions) {
  const system = def.kind === 'system';
  const table = system
    ? 'system_metric_bucket_item'
    : 'http_metric_bucket_item';
  const dimensions = system ? systemDimensions : httpDimensions;
  const keys = [...dimensions, 'bucket_start', 'resolution'];
  const aggregates: Record<string, string> = system
    ? {
        sample_count: 'sum(source."sample_count")::int',
        minimum: 'min(source."minimum")',
        maximum: 'max(source."maximum")',
        sum: 'sum(source."sum")',
        last: '(array_agg(source."last" order by source."bucket_start" desc))[1]',
      }
    : {
        person_handle: 'max(source."person_handle")',
        api_token_handle: 'max(source."api_token_handle")',
        ...Object.fromEntries(
          [
            'request_count',
            'client_error_count',
            'server_error_count',
            'aborted_count',
            'timeout_count',
            'request_bytes',
            'response_bytes',
            'duration_sum_ms',
            'impersonated_count',
          ].map((column) => [
            column,
            `sum(source.${q(column)})${column.endsWith('_count') ? '::int' : ''}`,
          ]),
        ),
        duration_max_ms: 'max(source."duration_max_ms")',
        duration_histogram: `jsonb_build_array(${Array.from(
          { length: 10 },
          (_, index) =>
            `sum(coalesce((source."duration_histogram"->>${index})::int, 0))`,
        ).join(', ')})`,
      };
  const values = Object.keys(aggregates);
  const bin = (value: string) =>
    `date_bin(interval '${def.minutes} minutes', ${value}, timestamptz '2000-01-01T00:00:00Z')`;
  const bucket = bin('source."bucket_start"');
  const now = '(select at from settings)';
  const retainedFrom = `${now} - interval '${def.retentionHours} hours'`;
  const match = (left: string, right: string) =>
    keys.map((key) => `${left}.${q(key)} = ${right}.${q(key)}`).join(' and ');
  const differs = (left: string, right: string) =>
    `row(${values.map((key) => `${left}.${q(key)}`).join(', ')}) is distinct from
     row(${values.map((key) => `${right}.${q(key)}`).join(', ')})`;
  const params: unknown[] = [options.now.toISOString()];
  const repair = options.repair;
  let filter: string;
  let targetFilter = '';
  if (repair) {
    params.push(
      repair.environment,
      repair.from.toISOString(),
      repair.to.toISOString(),
    );
    // Parameters also constrain the preview's existing targets, including those
    // whose original samples have expired or whose coverage has gaps.
    const environment = system
      ? `exists (select 1 from system_telemetry_instance_item instance
          where instance.handle = source.instance_handle and instance.environment_handle = (select environment from settings))`
      : `source.environment_handle = (select environment from settings)`;
    targetFilter = `${environment} and source.resolution = '${def.target}'
      and source.bucket_start >= (select range_from from settings)
      and source.bucket_start < (select range_to from settings)`;
    filter = `${environment} and ${bucket} >= (select range_from from settings)
      and ${bucket} + interval '${def.minutes} minutes' <= (select range_to from settings)`;
    if (system) {
      // MikroORM expands array parameters as SQL lists. A JSON scalar works
      // consistently through both the ORM and the direct PostgreSQL test client.
      params.push(JSON.stringify(repair.metricKeys ?? []));
      const allowedKeys =
        '(select jsonb_array_elements_text(metric_keys) from settings)';
      filter += ` and source.metric_key in ${allowedKeys}`;
      targetFilter += ` and source.metric_key in ${allowedKeys}`;
    }
  } else {
    filter = `(${bucket} >= ${bin(`${now} - interval '2 hours'`)} or not exists (
      select 1 from ${q(table)} target_bucket
      where target_bucket.resolution = '${def.target}' and target_bucket.bucket_start = ${bucket}
        and ${dimensions.map((key) => `target_bucket.${q(key)} = source.${q(key)}`).join(' and ')}))`;
  }
  const sourceSeconds = { '10s': 10, '1m': 60, '15m': 900 }[def.source];
  const complete =
    repair && system
      ? `count(*) = ${(def.minutes * 60) / sourceSeconds} and bool_and(source.sample_count = 1)`
      : 'true';
  const ctes = `with settings as (select ?::timestamptz as at${
    repair
      ? `, ?::text as environment, ?::timestamptz as range_from, ?::timestamptz as range_to${system ? ', ?::jsonb as metric_keys' : ''}`
      : ''
  }),
    aggregated as (
      select ${dimensions.map((key) => `source.${q(key)}`).join(', ')},
        ${bucket} as bucket_start, '${def.target}'::varchar as resolution,
        ${Object.entries(aggregates)
          .map(([key, sql]) => `${sql} as ${q(key)}`)
          .join(', ')},
        (${complete}) as source_complete
      from ${q(table)} source
      where source.resolution = '${def.source}'
        and source.bucket_start >= ${retainedFrom}
        and ${bucket} >= ${retainedFrom}
        and source.bucket_start < ${bin(now)}
        and ${filter}
      group by ${dimensions.map((key) => `source.${q(key)}`).join(', ')}, ${bucket}
    )`;
  const columns = [...keys, ...values];
  const upsert = `${ctes}
    insert into ${q(table)} as persisted (${columns.map(q).join(', ')}, created_at)
    select ${columns.map(q).join(', ')}, now() from aggregated where source_complete
    on conflict (${keys.map(q).join(', ')}) do update set
      ${values.map((key) => `${q(key)} = excluded.${q(key)}`).join(', ')}
    where ${differs('persisted', 'excluded')}
    returning handle`;
  const preview = repair
    ? `${ctes}, existing as (
      select * from ${q(table)} source where ${targetFilter}
    ) select count(*) filter (where aggregated.source_complete)::int as reconstructible,
      count(*) filter (where aggregated.source_complete and
        (existing.handle is null or ${differs('existing', 'aggregated')}))::int as changes,
      count(*) filter (where aggregated.source_complete is not true)::int as unreconstructible
    from aggregated full join existing on ${match('aggregated', 'existing')}`
    : '';
  return { upsert, preview, params };
}
