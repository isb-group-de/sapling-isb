import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSeedCatalog, parseSeedName, seedDataset } from './seed-catalog';

describe('Versioned seed catalog', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sapling-seeds-'));
    mkdirSync(join(root, 'json-default'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const write = (scope: string, entity: string, name: string) => {
    const folder = join(root, `json-${scope}`, entity);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, name), '[]');
    return `json-${scope}/${entity}/${name}`;
  };

  it('follows the explicit order with a late 0002 and filters only the other environment', () => {
    const role = write('default', 'role', 'roleData_0001_insert.json');
    const demo = write(
      'demonstration',
      'person',
      'personData_0001_insert.json',
    );
    const prod = write('production', 'person', 'personData_0001_insert.json');
    const update = write('default', 'role', 'roleData_0002_update.json');
    const order = [role, prod, demo, update];
    expect(
      loadSeedCatalog('production', root, order).map((file) => file.path),
    ).toEqual([role, prod, update]);
    expect(
      loadSeedCatalog('demonstration', root, order).map((file) => file.path),
    ).toEqual([role, demo, update]);
  });

  it('does not regroup later default files ahead of earlier environment files', () => {
    const initial = write(
      'default',
      'language',
      'languageData_0001_insert.json',
    );
    const environment = write(
      'production',
      'language',
      'languageData_0001_update.json',
    );
    const later = write('default', 'language', 'languageData_0002_update.json');
    const order = [initial, environment, later];
    expect(
      loadSeedCatalog('production', root, order).map((file) => file.path),
    ).toEqual(order);
  });

  it('reads the current order file instead of caching it between runs', () => {
    const first = write('default', 'language', 'languageData_0001_insert.json');
    const path = join(root, 'seed-order.json');
    writeFileSync(path, JSON.stringify([first]));
    expect(loadSeedCatalog('production', root)).toHaveLength(1);
    const second = write(
      'default',
      'language',
      'languageData_0002_insert.json',
    );
    expect(() => loadSeedCatalog('production', root)).toThrow(second);
    writeFileSync(path, JSON.stringify([first, second]));
    expect(loadSeedCatalog('production', root)).toHaveLength(2);
  });

  it.each([
    'languageData_001.json',
    'languageData_0000_insert.json',
    'languageData_0001_upsert.json',
    'otherData_0001_insert.json',
  ])('rejects invalid or legacy filename %s', (filename) =>
    expect(() => parseSeedName('language', filename)).toThrow(),
  );

  it('rejects duplicate sequence numbers even when operations differ', () => {
    const first = write('default', 'language', 'languageData_0001_insert.json');
    const second = write(
      'default',
      'language',
      'languageData_0001_delete.json',
    );
    expect(() => loadSeedCatalog('production', root, [first, second])).toThrow(
      'Duplicate seed number',
    );
  });

  it('names files missing from or duplicated in the order', () => {
    const file = write('default', 'language', 'languageData_0001_insert.json');
    expect(() => loadSeedCatalog('production', root, [])).toThrow(
      `Seed files missing from seed-order.json: ${file}`,
    );
    expect(() => loadSeedCatalog('production', root, [file, file])).toThrow(
      `Duplicate seed-order.json entry: ${file}`,
    );
  });

  it('rejects stale references even for the other environment', () => {
    const stale = 'json-demonstration/person/personData_0001_insert.json';
    expect(() => loadSeedCatalog('production', root, [stale])).toThrow(
      `seed-order.json references a missing seed file: ${stale}`,
    );
  });

  it('requires the other environment files to be registered too', () => {
    const demo = write(
      'demonstration',
      'person',
      'personData_0001_insert.json',
    );
    expect(() => loadSeedCatalog('production', root, [])).toThrow(demo);
  });

  it.each([{}, [{ entity: 'person', through: 2 }], [null]])(
    'rejects unsupported schedule structures',
    (order) => {
      expect(() => loadSeedCatalog('production', root, order)).toThrow(
        'must be an array of full relative seed file paths',
      );
    },
  );

  it('rejects invalid environment names', () =>
    expect(() => seedDataset('../production')).toThrow());

  it.each(['production', 'demonstration'] as const)(
    'schedules every shipped %s script exactly once with consecutive folder numbering',
    (dataset) => {
      const files = loadSeedCatalog(dataset);
      expect(files.length).toBeGreaterThan(100);
      expect(new Set(files.map((file) => file.path)).size).toBe(files.length);
      expect(
        files
          .filter((file) => file.entity === 'person')
          .every((file) => file.scope === dataset),
      ).toBe(true);
      const folders = new Map<string, number[]>();
      for (const file of files) {
        const key = `${file.scope}/${file.entity}`;
        folders.set(key, [...(folders.get(key) || []), file.sequence]);
      }
      for (const numbers of folders.values())
        expect(numbers.sort((a, b) => a - b)).toEqual(
          numbers.map((_, i) => i + 1),
        );
    },
  );
});
