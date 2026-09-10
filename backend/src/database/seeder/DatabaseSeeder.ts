import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { SeedScriptItem } from '../../entity/SeedScriptItem';
import { loadSeedCatalog, seedDataset } from './seed-catalog';
import { executeSeedFile } from './seed-executor';
import {
  assertSeedBaselineState,
  markFreshBaseline,
} from '../baseline/baseline-state';

/** Shared defaults followed by the selected environment, in dependency phases. */
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const dataset = seedDataset();
    const files = loadSeedCatalog(dataset);
    await em.transactional(async (tx) => {
      await tx
        .getConnection('write')
        .execute(
          'select pg_advisory_xact_lock(?, ?)',
          [73621, 1],
          'all',
          tx.getTransactionContext(),
        );
      await assertSeedBaselineState(tx, dataset);
      await tx
        .getConnection('write')
        .execute(
          'set constraints all deferred',
          [],
          'run',
          tx.getTransactionContext(),
        );
      const successful = new Set(
        (await tx.find(SeedScriptItem, { isSuccess: true })).map(
          (row) => `${row.entityHandle}:${row.scriptName}`,
        ),
      );
      for (const file of files) {
        if (successful.has(`${file.entity}:${file.path}`)) continue;
        const fork = tx.fork({ keepTransactionContext: true });
        const result = await executeSeedFile(fork, file).catch((cause) => {
          throw new Error(`Seed failed: ${file.path}`, { cause });
        });
        fork.persist(
          fork.create(SeedScriptItem, {
            entityHandle: file.entity,
            scriptName: file.path,
            isSuccess: true,
            executedAt: new Date(),
          }),
        );
        await fork.flush();
        global.log.info(
          `Seed ${file.path}: ${JSON.stringify(result)} (existing inserts and missing update/delete targets are skipped).`,
        );
      }
      await markFreshBaseline(tx, dataset);
    });
  }
}
