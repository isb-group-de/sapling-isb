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
