import type { EntityManager } from '@mikro-orm/core';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SeedScriptItem } from '../../entity/SeedScriptItem';
import type { SeedDataset } from '../seeder/seed-catalog';
import manifest from './manifest.json';

export const BASELINE_ENTITY = '__baseline';
export const baselineName = (dataset: SeedDataset) =>
  `${manifest.version}/${dataset}`;

export function availableMigrations(): Set<string> {
  return new Set(
    readdirSync(join(__dirname, '..', 'migration'))
      .filter((name) => /^Migration\w+\.(ts|js)$/.test(name))
      .map((name) => name.replace(/\.(ts|js)$/, '')),
  );
}

export async function baselineMarkers(em: EntityManager) {
  return em.find(SeedScriptItem, {
    entityHandle: BASELINE_ENTITY,
    isSuccess: true,
  });
}

export async function assertSeedBaselineState(
  em: EntityManager,
  dataset: SeedDataset,
): Promise<void> {
  const markers = await baselineMarkers(em);
  if (markers.length) {
    if (
      markers.length !== 1 ||
      markers[0].scriptName !== baselineName(dataset)
    ) {
      throw new Error(
        'The database baseline belongs to a different dataset or version. Dataset switching requires a separate data migration.',
      );
    }
    return;
  }
  if (await em.count(SeedScriptItem, {})) {
    throw new Error(
      'Legacy seed history detected. Run orm:deploy once with DB_BASELINE_ADOPT=true.',
    );
  }
  const migrations = await (em
    .getConnection('write')
    .execute(
      'select name from mikro_orm_migrations order by name',
      [],
      'all',
      em.getTransactionContext(),
    ) as Promise<Array<{ name: string }>>);
  const available = availableMigrations();
  if (
    !migrations.some((row) => row.name === manifest.firstMigration) ||
    migrations.some((row) => !available.has(row.name))
  ) {
    throw new Error(
      'Fresh seeding requires the consolidated initial migration.',
    );
  }
  verifyBaselineFiles(dataset);
}

export async function markFreshBaseline(
  em: EntityManager,
  dataset: SeedDataset,
): Promise<void> {
  if ((await baselineMarkers(em)).length) return;
  em.persist(
    em.create(SeedScriptItem, {
      entityHandle: BASELINE_ENTITY,
      scriptName: baselineName(dataset),
      executedAt: new Date(),
      isSuccess: true,
    }),
  );
  await em.flush();
}

export function verifyBaselineFiles(dataset: SeedDataset): void {
  for (const file of manifest.files.filter(
    (file) =>
      file.path.startsWith('json-default/') ||
      file.path.startsWith(`json-${dataset}/`),
  )) {
    const content = JSON.stringify(
      JSON.parse(
        readFileSync(join(__dirname, '..', 'seeder', file.path), 'utf8'),
      ),
    );
    const hash = createHash('sha256').update(content).digest('hex');
    if (hash !== file.sha256)
      throw new Error(`Baseline file changed: ${file.path}`);
  }
}

export async function readSchemaHash(em: EntityManager): Promise<string> {
  const sql = readFileSync(join(__dirname, 'schema-catalog.sql'), 'utf8');
  const rows: unknown = await em
    .getConnection('write')
    .execute(sql, [], 'all', em.getTransactionContext());
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
