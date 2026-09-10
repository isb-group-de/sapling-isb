import type { EntityManager } from '@mikro-orm/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest from './manifest.json';
import { schemaHash, type SchemaEntry } from './schema-comparison';
import { assertBaselineSchema } from './schema-validation';

const reference = JSON.parse(
  readFileSync(join(__dirname, 'schema-reference.json'), 'utf8'),
) as SchemaEntry[];

describe('Baseline schema verification', () => {
  const manager = (rows: SchemaEntry[]) => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([
        {
          database: 'customer',
          postgres_version: '17.6',
          search_path: 'public',
          schema: 'public',
        },
      ]);
    const em = {
      getConnection: () => ({ execute }),
      getTransactionContext: () => undefined,
    } as unknown as EntityManager;
    return { em, execute };
  };

  it('ships the original catalog matching the frozen fingerprint', () => {
    expect(schemaHash(reference)).toBe(manifest.schemaHash);
    expect(reference.length).toBeGreaterThan(4000);
  });

  it('accepts a matching catalog without additional database operations', async () => {
    const { em, execute } = manager(reference);
    await expect(assertBaselineSchema(em)).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  const pre18 = reference.filter(
    (row) =>
      !(row.key.startsWith('constraint:') && row.value.startsWith('NOT NULL ')),
  );

  it('accepts the same baseline without PostgreSQL 18 NOT NULL catalog entries', async () => {
    expect(reference.length - pre18.length).toBeGreaterThan(1000);
    const { em, execute } = manager(pre18);
    await expect(assertBaselineSchema(em)).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('still rejects a real nullable column on a pre-18 catalog', async () => {
    const rows = pre18.map((row) =>
      row.key === 'column:address_item:street'
        ? { ...row, value: row.value.replace('|true|', '|false|') }
        : row,
    );
    expect(rows).not.toEqual(pre18);
    await expect(assertBaselineSchema(manager(rows).em)).rejects.toThrow(
      'Changed column:address_item:street',
    );
  });

  it('still rejects a missing column and foreign key on a pre-18 catalog', async () => {
    const key = reference.find(
      (row) =>
        row.key.startsWith('constraint:') &&
        row.value.startsWith('FOREIGN KEY'),
    )!.key;
    const rows = pre18.filter(
      (row) => row.key !== key && row.key !== 'column:person_item:first_name',
    );
    const error: unknown = await assertBaselineSchema(manager(rows).em).catch(
      (reason: unknown) => reason,
    );
    expect((error as Error).message).toContain(`Missing ${key}`);
    expect((error as Error).message).toContain(
      'Missing column:person_item:first_name',
    );
    expect((error as Error).message).not.toContain(
      'Missing constraint:person_item:person_item_first_name_not_null',
    );
  });

  it('rejects drift with database context and exact differences, using only selects', async () => {
    const missing = reference.find((row) => row.key === 'extension:vector')!;
    const { em, execute } = manager(reference.filter((row) => row !== missing));
    const error: unknown = await assertBaselineSchema(em).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('no history was changed');
    expect(message).toContain('"postgres_version":"17.6"');
    expect(message).toContain('"database":"customer"');
    expect(message).toContain('Missing extension:vector');
    expect(message).toContain('Expected: ["vector"]');
    expect(message).toContain('Schema differences (1)');
    for (const [sql] of execute.mock.calls as [string][])
      expect(sql.trim()).toMatch(/^select /i);
  });
});
