import type { EntityManager } from '@mikro-orm/core';
import { SeedScriptItem } from '../../entity/SeedScriptItem';
import { seedDataset } from '../seeder/seed-catalog';
import {
  availableMigrations,
  baselineMarkers,
  baselineName,
  markFreshBaseline,
  verifyBaselineFiles,
} from './baseline-state';
import manifest from './manifest.json';
import { validateLegacySeedHistory } from './legacy-seed-history';
import { assertBaselineSchema } from './schema-validation';

/** Runs before the migrator: replacing old history must never replay baseline data. */
export async function prepareDatabaseBaseline(
  em: EntityManager,
  mode: 'migrate' | 'seed' | 'all',
): Promise<void> {
  const dataset = seedDataset();
  const value = process.env.DB_BASELINE_ADOPT || 'false';
  if (value !== 'true' && value !== 'false')
    throw new Error('DB_BASELINE_ADOPT must be true or false');
  const adopt = value === 'true';
  if (adopt && mode !== 'all')
    throw new Error(
      'DB_BASELINE_ADOPT=true requires orm:deploy (UPDATE_MODE=all).',
    );
  await em.transactional(async (tx) => {
    const execute = <T extends object[] = Array<Record<string, unknown>>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T> =>
      tx
        .getConnection('write')
        .execute(sql, params, 'all', tx.getTransactionContext()) as Promise<T>;
    await execute('select pg_advisory_xact_lock(?, ?)', [73621, 1]);
    const tables = await execute<
      Array<{ seeds: string | null; migrations: string | null }>
    >(
      "select to_regclass('public.seed_script_item')::text as seeds, to_regclass('public.mikro_orm_migrations')::text as migrations",
    );
    const hasSeeds = !!tables[0]?.seeds;
    const markers = hasSeeds ? await baselineMarkers(tx) : [];
    if (markers.length) {
      if (
        markers.length !== 1 ||
        markers[0].scriptName !== baselineName(dataset)
      )
        throw new Error('Database dataset or baseline version mismatch.');
      return;
    }
    const migrations = tables[0]?.migrations
      ? await execute<Array<{ name: string }>>(
          'select name from mikro_orm_migrations order by name',
        )
      : [];
    const history = hasSeeds ? await tx.find(SeedScriptItem, {}) : [];
    const available = availableMigrations();
    const legacy =
      migrations.some((row) => !available.has(row.name)) || history.length > 0;
    if (!adopt) {
      if (legacy)
        throw new Error(
          'Legacy database detected. Set DB_BASELINE_ADOPT=true for one orm:deploy run after updating to the baseline cutoff.',
        );
      return;
    }
    if (!hasSeeds || !legacy)
      throw new Error(
        'Baseline adoption requires a fully deployed legacy database; use DB_BASELINE_ADOPT=false for a fresh installation.',
      );
    if (
      JSON.stringify(migrations.map((row) => row.name)) !==
      JSON.stringify(manifest.legacyMigrations)
    ) {
      throw new Error(
        'Migration history does not match the baseline cutoff; no history was changed.',
      );
    }
    const additional = validateLegacySeedHistory(history, dataset);
    if (additional.length)
      global.log.info(
        `Additional legacy seed history will be removed: ${additional.join(', ')}. Adoption retains the configured dataset ${dataset} and does not change application records.`,
      );
    verifyBaselineFiles(dataset);
    await assertBaselineSchema(tx);
    await execute(
      'lock table mikro_orm_migrations, seed_script_item in access exclusive mode',
    );
    await execute('delete from mikro_orm_migrations where name <> ?', [
      manifest.firstMigration,
    ]);
    await execute('delete from seed_script_item');
    tx.clear();
    for (const file of manifest.files.filter(
      (file) =>
        file.path.startsWith('json-default/') ||
        file.path.startsWith(`json-${dataset}/`),
    )) {
      tx.persist(
        tx.create(SeedScriptItem, {
          entityHandle: file.entity,
          scriptName: file.path,
          executedAt: new Date(),
          isSuccess: true,
        }),
      );
    }
    await markFreshBaseline(tx, dataset);
    global.log.info(
      `Adopted ${baselineName(dataset)} without changing application records.`,
    );
  });
}
