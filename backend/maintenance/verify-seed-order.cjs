// Run from repository root after building backend. Only newly created disposable databases are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('../node_modules/pg');
require('../node_modules/dotenv').config({ path: 'backend/.env', quiet: true });
require('reflect-metadata');

async function main() {
  const { MikroORM } = require('../node_modules/@mikro-orm/postgresql');
  const config = require('../dist/database/mikro-orm.config').default;
  const { DatabaseSeeder } = require('../dist/database/seeder/DatabaseSeeder');
  const { loadSeedCatalog } = require('../dist/database/seeder/seed-catalog');
  const {
    verifyBaselineFiles,
  } = require('../dist/database/baseline/baseline-state');
  const snapshotPath = path.resolve(
    'backend/src/database/migration/.snapshot-sapling.json',
  );
  const snapshot = fs.readFileSync(snapshotPath, 'utf8');
  const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const admin = new Client({ ...options, database: 'postgres' });
  let sharedTranslations;
  global.log = { info() {}, debug() {}, warn() {}, error() {} };
  await admin.connect();
  try {
    for (const dataset of ['production', 'demonstration']) {
      const database = `sapling_seed_order_${dataset}_${Date.now()}`;
      assert.match(
        database,
        /^sapling_seed_order_(production|demonstration)_[0-9]+$/,
      );
      assert.notEqual(database, process.env.DB_NAME);
      let created = false,
        orm;
      try {
        await admin.query(`create database "${database}"`);
        created = true;
        process.env.DB_DATA_SEEDER = dataset;
        process.env.DB_BASELINE_ADOPT = 'false';
        verifyBaselineFiles(dataset);
        const files = loadSeedCatalog(dataset);
        orm = await MikroORM.init({
          ...config,
          ...options,
          dbName: database,
          entities: [path.resolve('backend/dist/entity/*.js')],
          entitiesTs: [],
          migrations: {
            ...config.migrations,
            path: path.resolve('backend/dist/database/migration'),
            pathTs: path.resolve('backend/src/database/migration'),
            snapshot: false,
          },
          debug: false,
          pool: { min: 0, max: 2 },
        });
        await orm.migrator.up();
        await new DatabaseSeeder().run(orm.em.fork());
        const connection = orm.em.getConnection();
        const tracking = await connection.execute(
          'select entity_handle, script_name from seed_script_item order by handle',
        );
        assert.equal(tracking.length, files.length + 1);
        assert.deepEqual(
          tracking
            .filter((r) => r.entity_handle !== '__baseline')
            .map((r) => r.script_name),
          files.map((f) => f.path),
        );
        assert.equal(
          tracking.filter((r) => r.entity_handle === '__baseline').length,
          1,
        );
        const roles = await connection.execute(
          'select * from person_item_roles where person_item_handle=1',
        );
        assert.ok(
          roles.some((row) => row.role_item_handle === 1),
          'Person 1 must have the administrator role',
        );
        const events = await connection.execute(
          'select count(*)::int as count from person_item_events',
        );
        assert.equal(events[0].count > 0, dataset === 'demonstration');
        const prompts = await connection.execute(
          'select count(*)::int as count from ai_prompt_template_item where published_version_handle is null',
        );
        assert.equal(
          prompts[0].count,
          0,
          'Deferred prompt links must be complete',
        );
        const translations = await connection.execute(
          'select entity, property, language_handle, value from translation_item order by entity, property, language_handle',
        );
        if (sharedTranslations)
          assert.deepEqual(
            translations,
            sharedTranslations,
            'Both environments must have identical shared UI translations',
          );
        else sharedTranslations = translations;
        const tables = await connection.execute(
          "select tablename from pg_tables where schemaname='public' order by tablename",
        );
        const fingerprint = async () => {
          const result = [];
          for (const { tablename } of tables) {
            assert.match(tablename, /^[a-z0-9_]+$/);
            result.push(
              await connection.execute(
                `select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) as hash from "${tablename}" t`,
              ),
            );
          }
          return result;
        };
        const before = await fingerprint();
        await new DatabaseSeeder().run(orm.em.fork());
        assert.deepEqual(
          await fingerprint(),
          before,
          'Repeat seeding must preserve all rows and history',
        );
        console.log(
          JSON.stringify({
            dataset,
            files: files.length,
            fresh: true,
            explicitOrder: true,
            translations: translations.length,
            relations: true,
            repeatUnchanged: true,
          }),
        );
      } finally {
        if (orm) await orm.close(true);
        if (created) await admin.query(`drop database "${database}"`);
      }
    }
    assert.equal(
      fs.readFileSync(snapshotPath, 'utf8'),
      snapshot,
      'Verification must preserve the shared snapshot',
    );
  } finally {
    await admin.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
