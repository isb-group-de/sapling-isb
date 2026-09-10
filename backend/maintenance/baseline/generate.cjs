// One-time consolidation from capture.cjs. Never queries or changes source databases.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const captureDir = path.resolve('../test-results/database-baseline');
const { entities, snapshots, dropSQL } = JSON.parse(
  fs.readFileSync(path.join(captureDir, 'capture.json'), 'utf8'),
);
const root = path.resolve('src/database/seeder');
const baselineRoot = path.resolve('src/database/baseline');
const audit = new Set(['createdAt', 'updatedAt', 'publishedAt']);
const byClass = new Map(entities.map((e) => [e.className, e]));
const byName = new Map(entities.map((e) => [e.name, e]));
const before = fs.readFileSync(
  path.join(captureDir, 'DatabaseSeeder.before.ts'),
  'utf8',
);
const classes = before
  .split('const SEED_ORDER:')[1]
  .split('= [')[1]
  .split('];')[0]
  .match(/\w+(?:Item|Seeder|PayloadType)/g);
const order = classes.flatMap((name) =>
  name === 'AiPromptSeeder'
    ? ['aiPromptTemplate', 'aiPromptVersion']
    : name === 'TranslationSeeder'
      ? ['translation']
      : name === 'PermissionSeeder'
        ? ['permission']
        : name === 'RoleStarterSeeder'
          ? []
          : byClass.has(name)
            ? [byClass.get(name).name]
            : [],
);
for (const entity of entities) {
  if (
    entity.name !== 'seedScript' &&
    !order.includes(entity.name) &&
    Object.values(snapshots).some((s) => s.data[entity.table]?.length)
  )
    order.push(entity.name);
}
const position = new Map(order.map((name, i) => [name, i]));
const normalize = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyFor = (entity, row) =>
  entity.name === 'translation'
    ? { entity: row.entity, property: row.property, language: row.language }
    : entity.name === 'permission'
      ? { entity: row.entity, role: row.role }
      : Object.fromEntries(entity.primaryKeys.map((key) => [key, row[key]]));

function exportRows(entity, dataset) {
  const source = snapshots[dataset].data;
  const people = JSON.parse(
    fs.readFileSync(path.join(captureDir, `${dataset}-person.json`), 'utf8'),
  );
  return (source[entity.table] || [])
    .map((raw) => {
      const row = {};
      for (const prop of entity.properties) {
        if (
          prop.kind === 'scalar' ||
          ((prop.kind === 'm:1' || prop.kind === '1:1') && prop.owner)
        ) {
          if (prop.fieldNames.length !== 1)
            throw new Error(
              `Unsupported composite property: ${entity.name}.${prop.name}`,
            );
          row[prop.name] = raw[prop.fieldNames[0]];
        } else if (prop.kind === 'm:n' && prop.owner) {
          row[prop.name] = (source[prop.pivotTable] || [])
            .filter((p) => p[prop.joinColumns[0]] === raw.handle)
            .map((p) => p[prop.inverseJoinColumns[0]])
            .sort((a, b) =>
              String(a).localeCompare(String(b), 'en', { numeric: true }),
            );
        }
      }
      if (entity.name === 'translation' || entity.name === 'permission')
        delete row.handle;
      if (entity.name === 'person') {
        const original = people.find(
          (p) => p.loginName && p.loginName === row.loginName,
        );
        if (row.loginPassword && !original?.loginPassword)
          throw new Error('Person password has no original bootstrap seed');
        row.loginPassword = original?.loginPassword ?? null;
      }
      if (
        entity.name === 'aiProviderType' &&
        row.credentials &&
        Object.keys(row.credentials).length
      ) {
        throw new Error('Provider credentials must not be exported');
      }
      return normalize(row);
    })
    .sort((a, b) =>
      JSON.stringify(keyFor(entity, a)).localeCompare(
        JSON.stringify(keyFor(entity, b)),
        'en',
        { numeric: true },
      ),
    );
}

function splitRelations(entity, row) {
  const record = { ...row },
    relations = {};
  for (const prop of entity.properties) {
    if (prop.kind === 'm:n' && prop.owner) {
      if (record[prop.name]?.length) relations[prop.name] = record[prop.name];
      delete record[prop.name];
    } else if (
      (prop.kind === 'm:1' || prop.kind === '1:1') &&
      prop.owner &&
      record[prop.name] != null
    ) {
      const target = byClass.get(prop.type);
      if (target && position.get(target.name) >= position.get(entity.name)) {
        if (!prop.nullable)
          throw new Error(
            `Non-null forward dependency: ${entity.name}.${prop.name}`,
          );
        relations[prop.name] = record[prop.name];
        record[prop.name] = null;
      }
    }
  }
  return { record, relations };
}

function main() {
  if (!process.argv.includes('--replace-baseline'))
    throw new Error(
      'One-time generator: pass --replace-baseline only during the authorized baseline consolidation.',
    );
  if (snapshots.production.schemaHash !== snapshots.demonstration.schemaHash)
    throw new Error('Source schemas differ');
  if (
    Object.values(snapshots).some(
      (snapshot) => snapshot.data.field_permission_item?.length,
    )
  ) {
    throw new Error(
      'Permission surrogate IDs require explicit remapping when field-permission records exist',
    );
  }
  const generated = new Map();
  function add(scope, entity, sequence, operation, row) {
    const relative = `json-${scope}/${entity}/${entity}Data_${String(sequence).padStart(4, '0')}_${operation}.json`;
    if (!generated.has(relative)) generated.set(relative, []);
    generated.get(relative).push(row);
  }
  for (const name of order) {
    const entity = byName.get(name);
    const demo = new Map(
      exportRows(entity, 'demonstration').map((row) => [
        JSON.stringify(keyFor(entity, row)),
        row,
      ]),
    );
    const prod = new Map(
      exportRows(entity, 'production').map((row) => [
        JSON.stringify(keyFor(entity, row)),
        row,
      ]),
    );
    for (const key of new Set([...prod.keys(), ...demo.keys()])) {
      const p = prod.get(key),
        d = demo.get(key);
      const shared = p && d && name !== 'person';
      if (shared) {
        const base = splitRelations(entity, p);
        add('default', name, 1, 'insert', base.record);
        if (Object.keys(base.relations).length)
          add('default', name, 3, 'update', {
            key: keyFor(entity, p),
            values: base.relations,
          });
        const next = splitRelations(entity, d);
        const values = Object.fromEntries(
          Object.entries(next.record).filter(
            ([k, v]) => !audit.has(k) && !same(v, base.record[k]),
          ),
        );
        if (Object.keys(values).length)
          add('demonstration', name, 2, 'update', {
            key: keyFor(entity, d),
            values,
          });
        const relationValues = {};
        for (const k of new Set([
          ...Object.keys(base.relations),
          ...Object.keys(next.relations),
        ])) {
          const value =
            next.relations[k] ?? (Array.isArray(base.relations[k]) ? [] : null);
          if (!same(value, base.relations[k])) relationValues[k] = value;
        }
        if (Object.keys(relationValues).length)
          add('demonstration', name, 3, 'update', {
            key: keyFor(entity, d),
            values: relationValues,
          });
      } else {
        for (const [scope, row] of [
          ['production', p],
          ['demonstration', d],
        ]) {
          if (!row) continue;
          const parts = splitRelations(entity, row);
          add(scope, name, 1, 'insert', parts.record);
          if (Object.keys(parts.relations).length)
            add(scope, name, 3, 'update', {
              key: keyFor(entity, row),
              values: parts.relations,
            });
        }
      }
    }
  }
  // Only remove the explicitly scoped seed-data directories; preserve runtime source files.
  for (const scope of ['default', 'production', 'demonstration']) {
    const directory = path.resolve(root, `json-${scope}`);
    if (path.dirname(directory) !== root)
      throw new Error('Unsafe output directory');
    fs.rmSync(directory, { recursive: true, force: true });
    fs.mkdirSync(directory, { recursive: true });
  }
  const files = [];
  for (const [relative, rows] of generated) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const content = JSON.stringify(rows, null, 2) + '\n';
    fs.writeFileSync(destination, content);
    files.push({
      path: relative,
      entity: relative.split('/')[1],
      sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    });
  }
  fs.writeFileSync(
    path.join(root, 'seed-order.json'),
    JSON.stringify(
      order
        .flatMap((entity) => [{ entity, through: 2 }])
        .concat(order.map((entity) => ({ entity, after: 2 }))),
      null,
      2,
    ) + '\n',
  );
  const manifest = {
    version: '2026-09-baseline-v1',
    firstMigration: 'Migration20260708104812',
    schemaHash: snapshots.production.schemaHash,
    legacyMigrations: snapshots.production.data.mikro_orm_migrations
      .map((r) => r.name)
      .sort(),
    legacySeeds: Object.fromEntries(
      Object.entries(snapshots).map(([mode, snapshot]) => [
        mode,
        snapshot.data.seed_script_item
          .filter((r) => r.is_success)
          .map((r) => ({ entity: r.entity_handle, script: r.script_name })),
      ]),
    ),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
  fs.writeFileSync(
    path.join(baselineRoot, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  // Preserve exact PostgreSQL details that ORM schema comparisons normalize away
  // (standalone unique indexes, timestamp precision and extension operator classes).
  const schemaSQL = fs
    .readFileSync(path.join(captureDir, 'schema.sql'), 'utf8')
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^(--|SET |SELECT pg_catalog\.set_config|COMMENT ON EXTENSION|CREATE EXTENSION IF NOT EXISTS vector|\\)/.test(
          line,
        ),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const up = ['CREATE EXTENSION IF NOT EXISTS vector;', schemaSQL];
  const down = [
    dropSQL,
    'drop function if exists sapling_immutable_prompt_version();',
  ];
  const literal = (sql) =>
    '`' +
    sql
      .replaceAll('\\', '\\\\')
      .replaceAll('`', '\\`')
      .replaceAll('${', '\\${') +
    '`';
  const migration = `import { Migration } from '@mikro-orm/migrations';\n\n// Generated consolidated schema; keep the historical migration identity unchanged.\nexport class Migration20260708104812 extends Migration {\n  override up(): void {\n${up.map((sql) => `    this.addSql(${literal(sql)});`).join('\n')}\n  }\n\n  override down(): void {\n${down.map((sql) => `    this.addSql(${literal(sql)});`).join('\n')}\n  }\n}\n`;
  const directory = path.resolve('src/database/migration');
  for (const file of fs
    .readdirSync(directory)
    .filter((f) => /^Migration\d+\.ts$/.test(f)))
    fs.unlinkSync(path.join(directory, file));
  fs.writeFileSync(
    path.join(directory, 'Migration20260708104812.ts'),
    migration,
  );
  console.log(
    JSON.stringify({
      entities: order.length,
      files: files.length,
      scopes: Object.fromEntries(
        ['default', 'production', 'demonstration'].map((scope) => [
          scope,
          files.filter((f) => f.path.startsWith(`json-${scope}/`)).length,
        ]),
      ),
    }),
  );
}
main();
