import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import order from './seed-order.json';

export type SeedDataset = 'production' | 'demonstration';
export type SeedOperation = 'insert' | 'update' | 'delete';
export type SeedRecord = Record<string, unknown>;
export type SeedFile = {
  path: string;
  entity: string;
  scope: 'default' | SeedDataset;
  sequence: number;
  operation: SeedOperation;
  rows: SeedRecord[];
};
export type SeedPhase = { entity: string; through?: number; after?: number };

export function seedDataset(value = process.env.DB_DATA_SEEDER): SeedDataset {
  const dataset = value || 'demonstration';
  if (dataset !== 'production' && dataset !== 'demonstration') {
    throw new Error(`Unsupported DB_DATA_SEEDER: ${dataset}`);
  }
  return dataset;
}

export function isSeedRecord(value: unknown): value is SeedRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSeedName(entity: string, filename: string) {
  const match = /^(\w+)Data_(\d{4})_(insert|update|delete)\.json$/.exec(
    filename,
  );
  if (!match || match[1] !== entity || Number(match[2]) === 0) {
    throw new Error(`Invalid seed filename: ${entity}/${filename}`);
  }
  return { sequence: Number(match[2]), operation: match[3] as SeedOperation };
}

export function loadSeedCatalog(
  dataset: SeedDataset,
  root = __dirname,
  phases: SeedPhase[] = order,
): SeedFile[] {
  const files: SeedFile[] = [];
  for (const scope of ['default', dataset] as const) {
    const directory = join(root, `json-${scope}`);
    if (!existsSync(directory)) {
      if (scope === 'default')
        throw new Error('Missing json-default seed directory');
      continue;
    }
    for (const folder of readdirSync(directory, { withFileTypes: true })) {
      if (!folder.isDirectory())
        throw new Error(`Unexpected seed entry: ${folder.name}`);
      const numbers = new Set<number>();
      for (const filename of readdirSync(join(directory, folder.name))) {
        const parsed = parseSeedName(folder.name, filename);
        if (numbers.has(parsed.sequence))
          throw new Error(
            `Duplicate seed number: ${folder.name}/${parsed.sequence}`,
          );
        numbers.add(parsed.sequence);
        const rows: unknown = JSON.parse(
          readFileSync(join(directory, folder.name, filename), 'utf8'),
        );
        if (!Array.isArray(rows) || !rows.every(isSeedRecord))
          throw new Error(`Expected a record array: ${filename}`);
        files.push({
          path: `json-${scope}/${folder.name}/${filename}`,
          entity: folder.name,
          scope,
          ...parsed,
          rows,
        });
      }
    }
  }
  const scheduled: SeedFile[] = [];
  for (const phase of phases) {
    scheduled.push(
      ...files
        .filter(
          (file) =>
            file.entity === phase.entity &&
            (phase.after === undefined || file.sequence > phase.after) &&
            (phase.through === undefined || file.sequence <= phase.through),
        )
        .sort(
          (a, b) =>
            Number(a.scope !== 'default') - Number(b.scope !== 'default') ||
            a.sequence - b.sequence,
        ),
    );
  }
  if (
    scheduled.length !== files.length ||
    new Set(scheduled.map((file) => file.path)).size !== files.length
  ) {
    throw new Error(
      'Every seed file must belong to exactly one phase in seed-order.json',
    );
  }
  return scheduled;
}
