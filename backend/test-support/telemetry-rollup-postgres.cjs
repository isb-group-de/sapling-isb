// Opt-in PostgreSQL regression: every write is confined to session-local tables.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Client } = require('pg');
const env = require('dotenv').parse(
  fs.readFileSync(path.join(__dirname, '../.env')),
);

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  module._compile(output.outputText, filename);
};
const {
  buildTelemetryRollup,
  TELEMETRY_ROLLUPS,
} = require('../src/api/system/services/system-telemetry-rollup.sql.ts');
const { repairTelemetry } = require('../src/maintenance/telemetry-repair.ts');
const client = new Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  application_name: 'sapling-telemetry-temporary-tests',
  options: '-c statement_timeout=15000',
});
const now = new Date('2026-09-06T14:00:35Z');
let assertions = 0;
function equal(actual, expected) {
  assert.deepEqual(actual, expected);
  assertions += 1;
}
async function query(sql, params = []) {
  let index = 0;
  return (
    await client.query(
      sql.replace(/\?/g, () => `$${++index}`),
      params,
    )
  ).rows;
}
async function clear() {
  await query(
    'truncate pg_temp.system_metric_bucket_item, pg_temp.http_metric_bucket_item',
  );
}
async function systemSamples(
  source,
  seconds,
  count,
  metric = 'host.cpu.percent',
  instance = 'a',
) {
  await query(
    `insert into system_metric_bucket_item
    (instance_handle, bucket_start, resolution, metric_key, sample_count, minimum, maximum, sum, last)
    select ?, timestamptz '2026-09-06T12:00:00Z' + n * interval '1 second', ?, ?, 1,
      n + 1, n + 1, n + 1, n + 1 from generate_series(0, ?, ?) n`,
    [instance, source, metric, (count - 1) * seconds, seconds],
  );
}
async function httpSamples(
  source,
  seconds,
  count,
  environment = 'env-a',
  kind = 'standard',
) {
  await query(
    `insert into http_metric_bucket_item
    (environment_handle, bucket_start, resolution, attribution_key, auth_kind, route_group,
     operation, request_kind, resource_key, person_handle, request_count, client_error_count,
     server_error_count, aborted_count, timeout_count, request_bytes, response_bytes,
     duration_sum_ms, duration_max_ms, duration_histogram, impersonated_count)
    select ?, timestamptz '2026-09-06T12:00:00Z' + n * interval '1 second', ?, 'person:1', 'session',
      'generic', 'GET /api/generic/:entityHandle', ?, 'ticket', 1, 2, 1, 1, 1, 1, 10, 20,
      30, n + 1, '[1,1,0,0,0,0,0,0,0,0]'::jsonb, 1
    from generate_series(0, ?, ?) n`,
    [environment, source, kind, (count - 1) * seconds, seconds],
  );
}

async function main() {
  await client.connect();
  await query('begin');
  // No public fallback: accidental fixture omissions fail instead of touching real tables.
  await query('set local search_path = pg_temp');
  await query(
    `create temporary table system_telemetry_environment_item (handle text primary key) on commit drop`,
  );
  await query(
    `create temporary table system_telemetry_instance_item (handle text primary key, environment_handle text) on commit drop`,
  );
  await query(
    `insert into system_telemetry_environment_item values ('env-a'), ('env-b')`,
  );
  await query(
    `insert into system_telemetry_instance_item values ('a','env-a'), ('b','env-b')`,
  );
  await query(`create temporary table system_metric_bucket_item (
    handle integer generated always as identity primary key, instance_handle text not null,
    bucket_start timestamptz not null, resolution varchar not null, metric_key text not null,
    dimension_key text not null default '', sample_count int not null,
    minimum double precision not null, maximum double precision not null,
    sum double precision not null, last double precision not null, created_at timestamptz default now(),
    unique(instance_handle,bucket_start,resolution,metric_key,dimension_key)) on commit drop`);
  await query(`create temporary table http_metric_bucket_item (
    handle integer generated always as identity primary key, environment_handle text not null,
    bucket_start timestamptz not null, resolution varchar not null, attribution_key text not null,
    auth_kind text not null, route_group text not null, operation text not null,
    request_kind text not null, resource_key text not null, person_handle int, api_token_handle int,
    request_count int, client_error_count int, server_error_count int, aborted_count int, timeout_count int,
    request_bytes bigint, response_bytes bigint, duration_sum_ms double precision,
    duration_max_ms double precision, duration_histogram jsonb, impersonated_count int,
    created_at timestamptz default now(),
    unique(environment_handle,bucket_start,resolution,attribution_key,route_group,operation,request_kind,resource_key,auth_kind)) on commit drop`);

  for (const def of TELEMETRY_ROLLUPS) {
    await clear();
    const seconds = { '10s': 10, '1m': 60, '15m': 900 }[def.source];
    const count = (def.minutes * 60) / seconds;
    if (def.kind === 'system') {
      await systemSamples(def.source, seconds, count);
      await systemSamples(def.source, seconds, count, 'host.cpu.percent', 'b');
      await query(
        `insert into system_metric_bucket_item
        (instance_handle,bucket_start,resolution,metric_key,sample_count,minimum,maximum,sum,last)
        values ('a','2026-09-06T14:00:00Z',?,'host.cpu.percent',1,999,999,999,999)`,
        [def.source],
      );
    } else {
      await httpSamples(def.source, seconds, count);
      await httpSamples(def.source, seconds, count, 'env-b');
      await httpSamples(def.source, seconds, count, 'env-a', 'stream');
    }
    const built = buildTelemetryRollup(def, { now });
    equal(
      (await query(built.upsert, built.params)).length,
      def.kind === 'system' ? 2 : 3,
    );
    if (def.kind === 'system') {
      const [row] = await query(
        `select sample_count,minimum,maximum,sum,last from system_metric_bucket_item
        where instance_handle='a' and resolution=? and bucket_start='2026-09-06T12:00:00Z'`,
        [def.target],
      );
      equal(row, {
        sample_count: count,
        minimum: 1,
        maximum: (count - 1) * seconds + 1,
        sum: count + (seconds * count * (count - 1)) / 2,
        last: (count - 1) * seconds + 1,
      });
      equal(
        (
          await query(
            `select * from system_metric_bucket_item where resolution=? and bucket_start='2026-09-06T14:00:00Z'`,
            [def.target],
          )
        ).length,
        0,
      );
    } else {
      const [row] = await query(
        `select * from http_metric_bucket_item
        where environment_handle='env-a' and resolution=? and request_kind='standard'`,
        [def.target],
      );
      equal(
        [
          row.request_count,
          row.client_error_count,
          row.server_error_count,
          row.aborted_count,
          row.timeout_count,
          Number(row.request_bytes),
          Number(row.response_bytes),
          row.duration_sum_ms,
          row.duration_max_ms,
          row.impersonated_count,
        ],
        [
          2 * count,
          count,
          count,
          count,
          count,
          10 * count,
          20 * count,
          30 * count,
          (count - 1) * seconds + 1,
          count,
        ],
      );
      equal(row.duration_histogram, [count, count, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    equal((await query(built.upsert, built.params)).length, 0);
    const later = buildTelemetryRollup(def, {
      now: new Date('2026-09-06T14:00:55Z'),
    });
    equal((await query(later.upsert, later.params)).length, 0);
    // A late source correction is incorporated while the entire bucket stays in scope.
    const table =
      def.kind === 'system'
        ? 'system_metric_bucket_item'
        : 'http_metric_bucket_item';
    const column = def.kind === 'system' ? 'sum' : 'duration_sum_ms';
    await query(
      `update ${table} set "${column}"="${column}"+1 where resolution=? and bucket_start='2026-09-06T12:00:00Z'`,
      [def.source],
    );
    equal(
      (await query(later.upsert, later.params)).length,
      def.kind === 'system' ? 2 : 3,
    );
    const aged = buildTelemetryRollup(def, {
      now: new Date('2026-09-06T15:01:05Z'),
    });
    // Old targets are skipped; the system's formerly open 14:00 bucket is now eligible.
    const changed = await query(aged.upsert, aged.params);
    equal(changed.length, def.kind === 'system' ? 1 : 0);
    // The left retention edge also intersects an existing target; never shrink it.
    const atRetention = buildTelemetryRollup(def, {
      now: new Date(
        new Date('2026-09-06T12:00:35Z').getTime() +
          def.retentionHours * 3600000,
      ),
    });
    equal((await query(atRetention.upsert, atRetention.params)).length, 0);
  }

  await clear();
  // Native minute metrics must survive the raw 10s -> minute maintenance pass.
  await systemSamples('1m', 60, 15, 'database.probeLatencyMs');
  const minute = buildTelemetryRollup(TELEMETRY_ROLLUPS[0], { now });
  equal((await query(minute.upsert, minute.params)).length, 0);
  equal(
    (await query(`select count(*)::int as n from system_metric_bucket_item`))[0]
      .n,
    15,
  );

  await clear();
  await systemSamples('10s', 10, 90);
  await systemSamples('10s', 10, 90, 'host.cpu.percent', 'b');
  await systemSamples('1m', 60, 15, 'database.probeLatencyMs');
  await httpSamples('1m', 60, 15);
  await httpSamples('1m', 60, 15, 'env-b');
  // Historical wrong target; repair must use original 10s values, not this bucket.
  await query(`insert into system_metric_bucket_item
    (instance_handle,bucket_start,resolution,metric_key,sample_count,minimum,maximum,sum,last)
    values ('a','2026-09-06T12:00:00Z','1m','host.cpu.percent',1,1,1,1,1),
      ('a','2026-09-01T12:00:00Z','15m','host.cpu.percent',1,1,1,1,1),
      ('a','2026-09-06T12:00:00Z','15m','web.bootMs',1,1,1,1,1)`);
  const repairOptions = {
    environment: 'env-a',
    from: new Date('2026-09-01T12:00:00Z'),
    to: new Date('2026-09-06T13:00:00Z'),
    apply: false,
  };
  const before = await query(
    'select * from system_metric_bucket_item order by handle',
  );
  const preview = await repairTelemetry(query, repairOptions, now);
  equal(
    await query('select * from system_metric_bucket_item order by handle'),
    before,
  );
  equal(preview.unsupported.length, 1);
  equal(
    preview.report.some((row) => row.unreconstructible > 0),
    true,
  );
  const applied = await repairTelemetry(
    query,
    { ...repairOptions, apply: true },
    now,
  );
  equal(
    preview.report.map((row) => row.changes),
    applied.report.map((row) => row.written),
  );
  equal(
    (
      await query(`select sample_count from system_metric_bucket_item where instance_handle='a'
    and metric_key='host.cpu.percent' and resolution='15m' and bucket_start='2026-09-06T12:00:00Z'`)
    )[0].sample_count,
    90,
  );
  equal(
    (
      await query(
        `select * from system_metric_bucket_item where instance_handle='b' and resolution <> '10s'`,
      )
    ).length,
    0,
  );
  equal(
    (
      await query(
        `select * from http_metric_bucket_item where environment_handle='env-b' and resolution <> '1m'`,
      )
    ).length,
    0,
  );
  const repeated = await repairTelemetry(
    query,
    { ...repairOptions, apply: true },
    now,
  );
  equal(
    repeated.report.reduce((sum, row) => sum + row.written, 0),
    0,
  );
  // Missing native slot: conservative repair refuses to overwrite the old aggregate.
  await query(
    `delete from system_metric_bucket_item where instance_handle='a' and resolution='10s' and bucket_start='2026-09-06T12:00:10Z'`,
  );
  const missing = await repairTelemetry(
    query,
    { ...repairOptions, apply: true },
    now,
  );
  equal(missing.report[0].unreconstructible > 0, true);
  equal(
    missing.report.reduce((sum, row) => sum + row.written, 0),
    0,
  );
  console.log(
    JSON.stringify({
      assertions,
      maintenanceStages: 5,
      repair:
        'preview, apply, repeat, expired sources, missing slots, environment isolation',
      writes: 'temporary tables only; rolled back',
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.query('rollback').catch(() => undefined);
    await client.end();
  });
