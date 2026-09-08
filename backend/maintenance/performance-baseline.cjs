// Read-only report. Run from the repository root: node backend/maintenance/performance-baseline.cjs
const { Client } = require('../node_modules/pg');
const { writeFileSync } = require('node:fs');
require('../node_modules/dotenv').config({ path: 'backend/.env', quiet: true });
const bounds = ['2026-09-06T22:00:00Z', '2026-09-07T22:00:00Z', '2026-09-07T10:55:00Z', '2026-09-07T11:15:00Z', 'host:sapling.isb-solutions.de'];
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
async function main() {
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const base = `from http_metric_bucket_item where resolution='1m' and bucket_start >= $1 and bucket_start < $2 and environment_handle=$5`;
    const select = `sum(request_count)::int as requests, round((sum(duration_sum_ms)/nullif(sum(request_count),0))::numeric,2) as mean_ms, max(duration_max_ms) as max_ms, sum(response_bytes)::text as recorded_response_bytes, sum(server_error_count)::int as server_errors, sum(client_error_count)::int as client_errors`;
    const outside = ` and not (bucket_start >= $3 and bucket_start < $4)`;
    const totals = await client.query(`select ${select} ${base}${outside} and request_kind='standard'`, bounds);
    const routes = await client.query(`select route_group, operation, resource_key, ${select} ${base}${outside} group by route_group, operation, resource_key order by sum(duration_sum_ms) desc limit 30`, bounds);
    const update = await client.query(`select ${select} ${base} and bucket_start >= $3 and bucket_start < $4`, bounds);
    const translations = await client.query(`select language_handle, entity, count(*)::int as rows from translation_item group by language_handle, entity order by language_handle,entity`);
    const report = { generatedAt: new Date().toISOString(), day: '2026-09-07', timezone: 'Europe/Berlin', environment: bounds[4], updateWindow: '12:55–13:15',
      standardOutsideUpdate: totals.rows[0], update: update.rows[0], routes: routes.rows,
      translationColdStart: Object.entries(Object.groupBy(translations.rows, r => r.language_handle)).map(([language, rows]) => ({ language, namespaces: rows.length, keys: rows.reduce((n,r) => n+r.rows,0),
        legacyPaginatedRequests: rows.reduce((n,r)=>n+Math.ceil(r.rows/100),0), bundleRequestsAt100Namespaces: Math.ceil(rows.length/100) })),
      limitations: ['Recorded bytes are not compressed network bytes.', 'Historical usage before and after deployment differs.', 'Cold-start calculation loads all namespaces; use the browser protocol for the visible-page workload.'],
    };
    const output = 'docs/development/performance-baseline-2026-09-07.json';
    writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
    console.log(JSON.stringify({ output, totals: report.standardOutsideUpdate, translationColdStart: report.translationColdStart }, null, 2));
    await client.query('ROLLBACK');
  } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
