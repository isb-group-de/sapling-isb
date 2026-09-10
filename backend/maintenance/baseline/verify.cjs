// Integration checks use dedicated databases. The two captured source databases remain unchanged.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const output = path.resolve('../test-results/database-baseline');
const capture = JSON.parse(
  fs.readFileSync(path.join(output, 'capture.json'), 'utf8'),
);
const statePath = path.join(output, 'test-databases.json');
const owned = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : [];
const connection = (database) =>
  new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });
const stable = (value) =>
  JSON.stringify(value, (_, child) =>
    child && !Array.isArray(child) && typeof child === 'object'
      ? Object.fromEntries(
          Object.keys(child)
            .sort()
            .map((key) => [key, child[key]]),
        )
      : child,
  );

async function provision(database, dataset, restore) {
  assert.match(
    database,
    /^sapling_baseline_(production|demonstration)_(fresh|adopt)_test$/,
  );
  const admin = connection('postgres');
  await admin.connect();
  try {
    const exists = (
      await admin.query('select 1 from pg_database where datname=$1', [
        database,
      ])
    ).rowCount;
    if (exists) {
      assert.ok(
        owned.includes(database),
        'Refusing to replace a database not created by this verifier',
      );
      await admin.query(`drop database "${database}"`);
    }
    await admin.query(`create database "${database}"`);
    if (!owned.includes(database)) owned.push(database);
    fs.writeFileSync(statePath, JSON.stringify(owned, null, 2));
  } finally {
    await admin.end();
  }
  if (restore) {
    const result = spawnSync(
      process.env.PG_RESTORE_PATH ||
        (process.platform === 'win32'
          ? 'C:/Program Files/PostgreSQL/18/bin/pg_restore.exe'
          : 'pg_restore'),
      [
        '--no-owner',
        '--no-acl',
        '--exit-on-error',
        '--dbname',
        database,
        path.join(output, `${capture.snapshots[dataset].database}.dump`),
      ],
      {
        env: {
          ...process.env,
          PGHOST: process.env.DB_HOST,
          PGPORT: process.env.DB_PORT || '5432',
          PGUSER: process.env.DB_USER,
          PGPASSWORD: process.env.DB_PASSWORD,
        },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    if (result.status !== 0)
      throw new Error(`Restore failed: ${result.stderr}`);
  }
}

function deploy(database, dataset, adopt, label, expectedSuccess = true) {
  const result = spawnSync(process.execPath, ['dist/update.js'], {
    env: {
      ...process.env,
      DB_NAME: database,
      DB_DATA_SEEDER: dataset,
      DB_BASELINE_ADOPT: String(adopt),
      UPDATE_MODE: 'all',
      DB_LOGGING: 'false',
    },
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  fs.writeFileSync(
    path.join(output, `${dataset}-${label}.log`),
    (result.stdout || '') + (result.stderr || ''),
  );
  if ((result.status === 0) !== expectedSuccess)
    throw new Error(
      `${dataset} ${label}: unexpected exit ${result.status}; see local verification log`,
    );
}

async function readState(database) {
  const client = connection(database);
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const catalog = (
      await client.query(
        fs.readFileSync('src/database/baseline/schema-catalog.sql', 'utf8'),
      )
    ).rows;
    const data = {};
    for (const { tablename } of (
      await client.query(
        "select tablename from pg_tables where schemaname='public' order by tablename",
      )
    ).rows) {
      assert.match(tablename, /^[a-z_][a-z0-9_]*$/);
      data[tablename] = (
        await client.query(`select row_to_json(t) as row from "${tablename}" t`)
      ).rows.map((r) => r.row);
    }
    await client.query('ROLLBACK');
    return { catalog, data };
  } finally {
    await client.end();
  }
}

function compareData(expected, actual, exact = false) {
  const ignoredTables = new Set(['seed_script_item', 'mikro_orm_migrations']);
  const differences = [];
  for (const table of new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ])) {
    if (ignoredTables.has(table)) continue;
    const normalize = (row) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([key]) =>
            exact ||
            (![
              'created_at',
              'updated_at',
              'published_at',
              'login_password',
            ].includes(key) &&
              !(
                ['translation_item', 'permission_item'].includes(table) &&
                key === 'handle'
              )),
        ),
      );
    const left = (expected[table] || [])
      .map((row) => stable(normalize(row)))
      .sort();
    const right = (actual[table] || [])
      .map((row) => stable(normalize(row)))
      .sort();
    if (stable(left) !== stable(right)) {
      const leftSet = new Set(left),
        rightSet = new Set(right);
      const missing = left.filter((row) => !rightSet.has(row));
      const extra = right.filter((row) => !leftSet.has(row));
      differences.push({
        table,
        expected: left.length,
        actual: right.length,
        missing: missing.length,
        extra: extra.length,
      });
      fs.writeFileSync(
        path.join(output, `difference-${table}.json`),
        JSON.stringify({ missing, extra }, null, 2),
      );
    }
  }
  assert.deepEqual(
    differences,
    [],
    `Data differs: ${JSON.stringify(differences)}`,
  );
}

async function verifyPasswords(dataset, rows) {
  const bcrypt = require('bcrypt');
  const originals = JSON.parse(
    fs.readFileSync(path.join(output, `${dataset}-person.json`), 'utf8'),
  );
  for (const row of rows) {
    const original = originals.find(
      (person) => person.loginName && person.loginName === row.login_name,
    );
    if (!original?.loginPassword) {
      assert.equal(row.login_password, null);
      continue;
    }
    if (original.loginPassword.startsWith('$2'))
      assert.equal(row.login_password, original.loginPassword);
    else
      assert.ok(
        await bcrypt.compare(original.loginPassword, row.login_password),
        `Bootstrap password mismatch for ${dataset} person ${row.handle}`,
      );
  }
}

async function rejectIncompleteAdoption(database, dataset) {
  const client = connection(database);
  await client.connect();
  try {
    const last = (
      await client.query(
        'delete from mikro_orm_migrations where id=(select max(id) from mikro_orm_migrations) returning *',
      )
    ).rows[0];
    const before = await readState(database);
    deploy(database, dataset, true, 'adopt-incomplete-migrations', false);
    assert.equal(stable(before), stable(await readState(database)));
    await client.query(
      'insert into mikro_orm_migrations select * from json_populate_record(null::mikro_orm_migrations, $1::json)',
      [JSON.stringify(last)],
    );
    const seed = (
      await client.query(
        'delete from seed_script_item where handle=(select max(handle) from seed_script_item) returning *',
      )
    ).rows[0];
    const missingSeed = await readState(database);
    deploy(database, dataset, true, 'adopt-incomplete-seeds', false);
    assert.equal(stable(missingSeed), stable(await readState(database)));
    await client.query(
      'insert into seed_script_item select * from json_populate_record(null::seed_script_item, $1::json)',
      [JSON.stringify(seed)],
    );
    await client.query(
      'alter table language_item add column baseline_test_drift text',
    );
    const drift = await readState(database);
    deploy(database, dataset, true, 'adopt-schema-drift', false);
    assert.equal(stable(drift), stable(await readState(database)));
    await client.query(
      'alter table language_item drop column baseline_test_drift',
    );
  } finally {
    await client.end();
  }
}

async function main() {
  const snapshotPath = path.resolve(
    'src/database/migration/.snapshot-sapling.json',
  );
  const snapshotBefore = fs.readFileSync(snapshotPath, 'utf8');
  const results = [];
  const modes = process.argv.includes('--production-only')
    ? ['production']
    : ['production', 'demonstration'];
  for (const dataset of modes) {
    const source = capture.snapshots[dataset];
    const freshDb = `sapling_baseline_${dataset}_fresh_test`;
    await provision(freshDb, dataset, false);
    deploy(freshDb, dataset, false, 'fresh');
    const fresh = await readState(freshDb);
    fs.writeFileSync(
      path.join(output, `${dataset}-fresh-catalog.json`),
      JSON.stringify(fresh.catalog, null, 2),
    );
    assert.deepEqual(
      fresh.catalog,
      source.catalog,
      'Fresh schema must match every captured column, constraint, index, extension, function and trigger',
    );
    compareData(source.data, fresh.data);
    await verifyPasswords(dataset, fresh.data.person_item);
    assert.equal(fresh.data.mikro_orm_migrations.length, 1);
    deploy(freshDb, dataset, false, 'fresh-repeat');
    const repeated = await readState(freshDb);
    compareData(fresh.data, repeated.data, true);
    assert.equal(
      stable(fresh.data.seed_script_item),
      stable(repeated.data.seed_script_item),
    );
    const adoptDb = `sapling_baseline_${dataset}_adopt_test`;
    await provision(adoptDb, dataset, true);
    await rejectIncompleteAdoption(adoptDb, dataset);
    const before = await readState(adoptDb);
    deploy(adoptDb, dataset, false, 'adopt-without-flag', false);
    assert.equal(stable(before), stable(await readState(adoptDb)));
    deploy(adoptDb, dataset, true, 'adopt');
    const after = await readState(adoptDb);
    compareData(before.data, after.data, true);
    assert.deepEqual(after.catalog, before.catalog);
    assert.deepEqual(
      after.data.mikro_orm_migrations,
      before.data.mikro_orm_migrations.filter(
        (row) => row.name === 'Migration20260708104812',
      ),
    );
    assert.equal(
      after.data.seed_script_item.length,
      fresh.data.seed_script_item.length,
    );
    deploy(adoptDb, dataset, true, 'adopt-repeat');
    assert.equal(stable(after), stable(await readState(adoptDb)));
    results.push({
      dataset,
      fresh: true,
      exactSchema: true,
      referenceData: true,
      repeat: true,
      adoptionPreservesAllRecords: true,
      trackingRows: after.data.seed_script_item.length,
      schemaHash: createHash('sha256')
        .update(JSON.stringify(after.catalog))
        .digest('hex'),
    });
    console.log(JSON.stringify(results.at(-1)));
  }
  fs.writeFileSync(
    path.join(output, 'verification.json'),
    JSON.stringify(results, null, 2),
  );
  assert.equal(
    fs.readFileSync(snapshotPath, 'utf8'),
    snapshotBefore,
    'Integration deployments must not rewrite the shared migration snapshot',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
