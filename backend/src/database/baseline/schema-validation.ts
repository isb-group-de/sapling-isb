import type { EntityManager } from '@mikro-orm/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest from './manifest.json';
import {
  compareSchema,
  formatSchemaDifferences,
  schemaHash,
  type SchemaEntry,
} from './schema-comparison';

export async function readSchemaCatalog(
  em: EntityManager,
): Promise<SchemaEntry[]> {
  return em
    .getConnection('write')
    .execute(
      readFileSync(join(__dirname, 'schema-catalog.sql'), 'utf8'),
      [],
      'all',
      em.getTransactionContext(),
    ) as Promise<SchemaEntry[]>;
}

export async function assertBaselineSchema(em: EntityManager): Promise<void> {
  const actual = await readSchemaCatalog(em);
  const actualHash = schemaHash(actual);
  if (actualHash === manifest.schemaHash) return;
  const expected = JSON.parse(
    readFileSync(join(__dirname, 'schema-reference.json'), 'utf8'),
  ) as SchemaEntry[];
  if (schemaHash(expected) !== manifest.schemaHash)
    throw new Error(
      'Bundled baseline schema reference does not match manifest.schemaHash. Rebuild the backend with matching baseline assets.',
    );
  const environment = await (em
    .getConnection('write')
    .execute(
      "select current_database() as database, current_setting('server_version') as postgres_version, current_setting('search_path') as search_path, current_schema() as schema",
      [],
      'all',
      em.getTransactionContext(),
    ) as Promise<Array<Record<string, string | null>>>);
  const differences = compareSchema(expected, actual);
  throw new Error(
    [
      'Database schema does not match the baseline cutoff; no history was changed.',
      `Environment: ${JSON.stringify(environment[0])}`,
      `Expected hash: ${manifest.schemaHash}; actual hash: ${actualHash}.`,
      `Schema differences (${differences.length}):`,
      formatSchemaDifferences(differences),
    ].join('\n'),
  );
}
