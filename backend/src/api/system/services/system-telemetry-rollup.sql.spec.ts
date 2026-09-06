import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Requires the configured local PostgreSQL connection. The child creates only
// temporary tables and removes public from search_path before exercising writes.
const postgresTest =
  process.env.SAPLING_TELEMETRY_SQL_TESTS === '1' ? it : it.skip;
describe('telemetry rollups against PostgreSQL', () => {
  postgresTest(
    'preserves complete buckets and repairs only retained native sources',
    () => {
      const output = execFileSync(
        process.execPath,
        [
          path.resolve(
            __dirname,
            '../../../../test-support/telemetry-rollup-postgres.cjs',
          ),
        ],
        { encoding: 'utf8', timeout: 60_000 },
      );
      const result = JSON.parse(output) as {
        assertions: number;
        maintenanceStages: number;
      };
      expect(result.assertions).toBeGreaterThan(40);
      expect(result.maintenanceStages).toBe(5);
    },
    65_000,
  );
});
