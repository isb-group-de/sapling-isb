import type { EntityManager, EntityMetadata } from '@mikro-orm/core';
import { executeSeedFile } from './seed-executor';
import { insertSeedKey, validateSeedKey } from './seed-identity';
import type { SeedFile, SeedRecord } from './seed-catalog';

jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_REGISTRY: [{ name: 'translation', class: class Translation {} }],
}));

const meta = {
  className: 'Translation',
  class: class Translation {},
  primaryKeys: ['handle'],
  uniques: [],
  props: [{ name: 'handle', primary: true }],
  properties: Object.fromEntries(
    ['handle', 'entity', 'property', 'language', 'value'].map((name) => [
      name,
      { name, kind: 'scalar', type: 'string', primary: name === 'handle' },
    ]),
  ),
} as unknown as EntityMetadata;

function manager(rows: SeedRecord[]) {
  return {
    getMetadata: () => ({ get: () => meta }),
    find: jest.fn().mockResolvedValue(rows),
    create: jest.fn((_entity: unknown, values: SeedRecord) => ({ ...values })),
    assign: jest.fn((row: SeedRecord, values: SeedRecord) =>
      Object.assign(row, values),
    ),
    persist: jest.fn(),
    remove: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
  };
}
function file(operation: SeedFile['operation'], rows: SeedRecord[]): SeedFile {
  return {
    path: `translationData_0001_${operation}.json`,
    entity: 'translation',
    scope: 'default',
    sequence: 1,
    operation,
    rows,
  };
}

describe('Explicit seed operations', () => {
  const key = { entity: 'ticket', property: 'title', language: 'de' };
  it('inserts missing records and leaves existing values unchanged, including duplicates in a file', async () => {
    const row = { handle: 1, ...key, value: 'Custom text' };
    const em = manager([row]);
    const next = { ...key, language: 'en', value: 'Title' };
    const result = await executeSeedFile(
      em as unknown as EntityManager,
      file('insert', [{ ...key, value: 'Titel' }, next, next]),
    );
    expect(result).toEqual({ inserted: 1, updated: 0, deleted: 0, skipped: 2 });
    expect(row.value).toBe('Custom text');
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.find).toHaveBeenCalledTimes(1);
  });
  it('updates only supplied fields and skips a missing target without inserting', async () => {
    const row = { handle: 1, ...key, value: 'Old' };
    const em = manager([row]);
    const result = await executeSeedFile(
      em as unknown as EntityManager,
      file('update', [
        { key, values: { value: 'New' } },
        { key: { ...key, language: 'en' }, values: { value: 'Title' } },
      ]),
    );
    expect(row).toEqual({ handle: 1, ...key, value: 'New' });
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(em.create).not.toHaveBeenCalled();
  });
  it('deletes only the named target and skips missing or already removed targets', async () => {
    const row = { handle: 1, ...key, value: 'Old' };
    const em = manager([row]);
    const result = await executeSeedFile(
      em as unknown as EntityManager,
      file('delete', [{ key }, { key }, { key: { handle: 2 } }]),
    );
    expect(em.remove).toHaveBeenCalledTimes(1);
    expect(em.remove).toHaveBeenCalledWith(row);
    expect(result).toEqual({ inserted: 0, updated: 0, deleted: 1, skipped: 2 });
  });
  it('rejects ambiguous natural keys', async () => {
    const em = manager([
      { handle: 1, ...key },
      { handle: 2, ...key },
    ]);
    await expect(
      executeSeedFile(
        em as unknown as EntityManager,
        file('delete', [{ key }]),
      ),
    ).rejects.toThrow('Ambiguous');
  });
  it('keeps alternate selectors consistent after a delete', async () => {
    const row = { handle: 1, ...key, value: 'Old' };
    const em = manager([row]);
    const result = await executeSeedFile(
      em as unknown as EntityManager,
      file('delete', [{ key: { handle: 1 } }, { key }]),
    );
    expect(result.deleted).toBe(1);
    expect(result.skipped).toBe(1);
  });
  it('resolves the new logical key after an earlier update in the same batch', async () => {
    const row = { handle: 1, ...key, value: 'Old' };
    const em = manager([row]);
    const result = await executeSeedFile(
      em as unknown as EntityManager,
      file('update', [
        { key, values: { property: 'renamed' } },
        { key: { ...key, property: 'renamed' }, values: { value: 'New' } },
      ]),
    );
    expect(result.updated).toBe(2);
    expect(row.value).toBe('New');
  });
  it('rejects primary-key changes and malformed operation payloads', async () => {
    const em = manager([{ handle: 1, ...key }]);
    await expect(
      executeSeedFile(
        em as unknown as EntityManager,
        file('update', [{ key, values: { handle: 2 } }]),
      ),
    ).rejects.toThrow('Unsupported seed field');
    await expect(
      executeSeedFile(
        em as unknown as EntityManager,
        file('delete', [{ key, values: { value: 'Unexpected' } }]),
      ),
    ).rejects.toThrow('Invalid delete');
  });
  it.each([
    {},
    { value: 'anything' },
    { handle: { $ne: null } },
    { entity: 'ticket' },
  ])('rejects unsafe selector %p', (key) => {
    expect(() => validateSeedKey('translation', meta, key)).toThrow();
  });
  it('uses a complete natural key when no primary key was supplied', () => {
    expect(
      insertSeedKey('translation', meta, { ...key, value: 'Titel' }),
    ).toEqual(key);
  });
});
