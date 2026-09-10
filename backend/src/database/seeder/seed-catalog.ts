import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
  order: unknown = JSON.parse(
    readFileSync(join(root, 'seed-order.json'), 'utf8'),
  ),
): SeedFile[] {
  if (
    !Array.isArray(order) ||
    !order.every((entry): entry is string => typeof entry === 'string')
  )
    throw new Error(
      'seed-order.json must be an array of full relative seed file paths',
    );
  const files: SeedFile[] = [];
  for (const scope of ['default', 'production', 'demonstration'] as const) {
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
  const byPath = new Map(files.map((file) => [file.path, file]));
  const registered = new Set<string>();
  for (const path of order) {
    if (registered.has(path))
      throw new Error(`Duplicate seed-order.json entry: ${path}`);
    if (!byPath.has(path))
      throw new Error(
        `seed-order.json references a missing seed file: ${path}`,
      );
    registered.add(path);
  }
  const missing = files.filter((file) => !registered.has(file.path));
  if (missing.length)
    throw new Error(
      `Seed files missing from seed-order.json: ${missing.map((file) => file.path).join(', ')}`,
    );
  return order.flatMap((path) => {
    const file = byPath.get(path)!;
    return file.scope === 'default' || file.scope === dataset ? [file] : [];
  });
}
