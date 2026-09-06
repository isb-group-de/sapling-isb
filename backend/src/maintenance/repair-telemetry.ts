import 'dotenv/config';
import { MikroORM } from '@mikro-orm/postgresql';
import {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} from '../constants/project.constants';
import { TELEMETRY_MAINTENANCE_LOCK_ID } from '../api/system/services/system-telemetry-rollup.sql';
import { parseTelemetryRepairArgs, repairTelemetry } from './telemetry-repair';

async function main() {
  const options = parseTelemetryRepairArgs(process.argv.slice(2));
  // No application bootstrap: no collectors, seeders, migrations, or jobs.
  const orm = await MikroORM.init({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    dbName: DB_NAME,
    entities: [],
    discovery: { warnWhenNoEntities: false },
    debug: false,
    pool: { min: 0, max: 1 },
  });
  try {
    const connection = orm.em.getConnection();
    const report = await connection.transactional(
      async (ctx) => {
        const query = (sql: string, params: readonly unknown[]) =>
          connection.execute<Array<Record<string, unknown>>>(
            sql,
            params,
            'all',
            ctx,
          );
        await query("set local statement_timeout = '60s'", []);
        const [lock] = await query(
          'select pg_try_advisory_xact_lock(?) as locked',
          [TELEMETRY_MAINTENANCE_LOCK_ID],
        );
        if (lock?.locked !== true)
          throw new Error('Telemetry maintenance is running; retry later.');
        const [clock] = await query('select now() as at', []);
        return repairTelemetry(query, options, new Date(clock.at as string));
      },
      { readOnly: !options.apply },
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await orm.close(true);
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Telemetry repair failed.',
  );
  process.exitCode = 1;
});
