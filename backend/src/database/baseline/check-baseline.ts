import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';
import { assertBaselineSchema } from './schema-validation';

/** Diagnostic only: PostgreSQL enforces a read-only transaction. */
async function checkBaseline() {
  dotenv.config();
  const orm = await MikroORM.init(config);
  try {
    await orm.em.fork().transactional(async (em) => {
      await em
        .getConnection('write')
        .execute(
          'set transaction read only',
          [],
          'run',
          em.getTransactionContext(),
        );
      await assertBaselineSchema(em);
    });
    console.log(
      'Database schema matches the baseline cutoff. No database changes were made.',
    );
  } finally {
    await orm.close();
  }
}
void checkBaseline().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
