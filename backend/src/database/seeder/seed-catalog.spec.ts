import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSeedCatalog, parseSeedName, seedDataset } from './seed-catalog';

describe('Versioned seed catalog', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sapling-seeds-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const write = (scope: string, entity: string, name: string) => {
    const folder = join(root, `json-${scope}`, entity);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, name), '[]');
  };
  it('loads defaults and only the selected environment in dependency phases', () => {
    write('default', 'role', 'roleData_0001_insert.json');
    write('default', 'role', 'roleData_0003_update.json');
    write('demonstration', 'person', 'personData_0001_insert.json');
    write('production', 'person', 'personData_0001_insert.json');
    const files = loadSeedCatalog('production', root, [
      { entity: 'role', through: 2 },
      { entity: 'person' },
      { entity: 'role', after: 2 },
    ]);
    expect(files.map((file) => file.path)).toEqual([
      'json-default/role/roleData_0001_insert.json',
      'json-production/person/personData_0001_insert.json',
      'json-default/role/roleData_0003_update.json',
    ]);
  });
  it('executes environment updates after defaults within a phase', () => {
    write('production', 'language', 'languageData_0001_update.json');
    write('default', 'language', 'languageData_0002_insert.json');
    expect(
      loadSeedCatalog('production', root, [{ entity: 'language' }]).map(
        (file) => file.scope,
      ),
    ).toEqual(['default', 'production']);
  });
  it.each([
    'languageData_001.json',
    'languageData_0000_insert.json',
    'languageData_0001_upsert.json',
    'otherData_0001_insert.json',
  ])('rejects invalid or legacy filename %s', (filename) =>
    expect(() => parseSeedName('language', filename)).toThrow(),
  );
  it('rejects duplicate sequence numbers even when their operations differ', () => {
    write('default', 'language', 'languageData_0001_insert.json');
    write('default', 'language', 'languageData_0001_delete.json');
    expect(() =>
      loadSeedCatalog('production', root, [{ entity: 'language' }]),
    ).toThrow('Duplicate seed number');
  });
  it('rejects files omitted from or repeated in the dependency schedule', () => {
    write('default', 'language', 'languageData_0001_insert.json');
    expect(() => loadSeedCatalog('production', root, [])).toThrow(
      'exactly one',
    );
    expect(() =>
      loadSeedCatalog('production', root, [
        { entity: 'language' },
        { entity: 'language' },
      ]),
    ).toThrow('exactly one');
  });
  it('rejects invalid environment names', () =>
    expect(() => seedDataset('../production')).toThrow());
  it.each(['production', 'demonstration'] as const)(
    'schedules every shipped %s script exactly once',
    (dataset) => {
      const files = loadSeedCatalog(dataset);
      expect(files.length).toBeGreaterThan(100);
      expect(new Set(files.map((file) => file.path)).size).toBe(files.length);
      expect(
        files
          .filter((file) => file.entity === 'person')
          .every((file) => file.scope === dataset),
      ).toBe(true);
    },
  );
});
