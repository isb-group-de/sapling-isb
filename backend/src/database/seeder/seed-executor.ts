import type { EntityManager, EntityMetadata } from '@mikro-orm/core';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { isSeedRecord, type SeedFile, type SeedRecord } from './seed-catalog';
import { insertSeedKey, seedIdentity, validateSeedKey } from './seed-identity';
import { prepareSeedValues, validateSeedPrompt } from './seed-values';

const BATCH_SIZE = 250;
export type SeedResult = {
  inserted: number;
  updated: number;
  deleted: number;
  skipped: number;
};

export async function executeSeedFile(
  em: EntityManager,
  file: SeedFile,
): Promise<SeedResult> {
  const entry = ENTITY_REGISTRY.find(
    (candidate) => candidate.name === file.entity,
  );
  if (!entry || file.entity === 'seedScript')
    throw new Error(`Unsupported seed entity: ${file.entity}`);
  const entityClass = entry.class;
  const meta = em.getMetadata().get(entityClass);
  const operations = file.rows.map((row) => {
    if (file.operation === 'insert')
      return { key: insertSeedKey(file.entity, meta, row), values: row };
    const allowed = file.operation === 'update' ? ['key', 'values'] : ['key'];
    if (
      Object.keys(row).some((key) => !allowed.includes(key)) ||
      (file.operation === 'update' &&
        (!isSeedRecord(row.values) || !Object.keys(row.values).length))
    ) {
      throw new Error(`Invalid ${file.operation} entry in ${file.path}`);
    }
    return {
      key: validateSeedKey(file.entity, meta, row.key),
      values: (row.values || {}) as SeedRecord,
    };
  });
  const result: SeedResult = {
    inserted: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  };
  const serial = meta.props.find((prop) => prop.primary && prop.autoincrement);
  const explicitIds =
    file.operation === 'insert' && serial
      ? file.rows
          .map((row) => row[serial.name])
          .filter((value): value is number => typeof value === 'number')
      : [];
  if (explicitIds.length)
    await advanceSeedSequence(
      em,
      meta,
      explicitIds.reduce((maximum, id) => Math.max(maximum, id), 1),
    );
  for (let offset = 0; offset < operations.length; offset += BATCH_SIZE) {
    const batch = operations.slice(offset, offset + BATCH_SIZE);
    const keys = batch.flatMap((item) => (item.key ? [item.key] : []));
    const found = keys.length ? await em.find(entityClass, { $or: keys }) : [];
    const fields = [
      ...new Set(keys.map((key) => Object.keys(key).sort().join('|'))),
    ];
    const requested = new Set(keys.map(seedIdentity));
    const existing = new Map<string, object>();
    const forget = (row: object) => {
      for (const [identity, value] of existing)
        if (value === row) existing.delete(identity);
    };
    const remember = (row: object) => {
      forget(row);
      for (const signature of fields) {
        const key = Object.fromEntries(
          signature.split('|').map((name) => {
            const value = (row as SeedRecord)[name];
            return [name, isSeedRecord(value) ? value.handle : (value ?? null)];
          }),
        );
        const identity = seedIdentity(key);
        if (!requested.has(identity)) continue;
        if (existing.has(identity))
          throw new Error(`Ambiguous seed key in ${file.path}: ${identity}`);
        existing.set(identity, row);
      }
    };
    for (const row of found) remember(row);
    for (const operation of batch) {
      const identity = operation.key ? seedIdentity(operation.key) : undefined;
      const target = identity ? existing.get(identity) : undefined;
      // Validate supplied fields even when the requested mutation becomes a no-op.
      const values = prepareSeedValues(
        em,
        meta,
        operation.values,
        file.operation === 'update',
      );
      if (
        (file.operation === 'insert' && target) ||
        (file.operation !== 'insert' && !target)
      ) {
        result.skipped++;
        continue;
      }
      if (file.operation === 'insert') {
        const created = em.create(entityClass, values as never);
        validateSeedPrompt(meta, created);
        em.persist(created);
        remember(created);
        result.inserted++;
      } else if (file.operation === 'update' && target) {
        em.assign(target, values as never);
        validateSeedPrompt(meta, target);
        remember(target);
        result.updated++;
      } else if (target) {
        em.remove(target);
        forget(target);
        result.deleted++;
      }
    }
    await em.flush();
    em.clear();
  }
  return result;
}

async function advanceSeedSequence(
  em: EntityManager,
  meta: EntityMetadata,
  minimum: number,
): Promise<void> {
  const prop = meta.props.find(
    (candidate) => candidate.primary && candidate.autoincrement,
  );
  if (!prop) return;
  const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
  const connection = em.getConnection('write');
  const rows = await (connection.execute(
    'select pg_get_serial_sequence(?, ?) as sequence',
    [meta.tableName, prop.fieldNames[0]],
    'all',
    em.getTransactionContext(),
  ) as Promise<Array<{ sequence: string | null }>>);
  if (!rows[0]?.sequence) return;
  const sequence = rows[0].sequence;
  const sequenceIdentifier = sequence.split('.').map(quote).join('.');
  await connection.execute(
    `select setval(?::regclass, greatest(?, (select coalesce(max(${quote(prop.fieldNames[0])}), 1) from ${quote(meta.tableName)}), (select last_value from ${sequenceIdentifier})), true)`,
    [sequence, minimum],
    'all',
    em.getTransactionContext(),
  );
}
