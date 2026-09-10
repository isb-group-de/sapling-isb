import type { SeedDataset } from '../seeder/seed-catalog';
import manifest from './manifest.json';

type SeedHistory = {
  entityHandle: string;
  scriptName: string;
  isSuccess: boolean;
};

/** Require the cutoff seeds; all additional old history is discarded on adoption. */
export function validateLegacySeedHistory(
  history: readonly SeedHistory[],
  dataset: SeedDataset,
): string[] {
  const identity = (row: SeedHistory) =>
    `${row.entityHandle}:${row.scriptName}`;
  const expected = new Set(
    manifest.legacySeeds[dataset].map((row) => `${row.entity}:${row.script}`),
  );
  const present = new Set(history.map(identity));
  const successful = new Set(
    history.filter((row) => row.isSuccess).map(identity),
  );
  const missing = [...expected].filter((name) => !successful.has(name)).sort();
  if (missing.length) {
    throw new Error(
      `Seed history does not match the baseline cutoff (DB_DATA_SEEDER=${dataset}); no history was changed.\nMissing successful seeds (${missing.length}): ${missing.join(', ')}.`,
    );
  }
  return [...present].filter((name) => !expected.has(name)).sort();
}
