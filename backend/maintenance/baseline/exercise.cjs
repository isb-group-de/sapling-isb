const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const { MikroORM } = require('@mikro-orm/postgresql');
const config = require('../../dist/database/mikro-orm.config').default;
const { executeSeedFile } = require('../../dist/database/seeder/seed-executor');
const { DatabaseSeeder } = require('../../dist/database/seeder/DatabaseSeeder');
const {
  prepareDatabaseBaseline,
} = require('../../dist/database/baseline/adopt-baseline');
const { TranslationItem } = require('../../dist/entity/TranslationItem');
const { LanguageItem } = require('../../dist/entity/LanguageItem');
const { PermissionItem } = require('../../dist/entity/PermissionItem');
const {
  AiPromptVersionItem,
} = require('../../dist/entity/AiPromptVersionItem');
const output = path.resolve('../test-results/database-baseline');
global.log = { info() {}, warn() {}, error() {}, debug() {} };
const seed = (entity, operation, rows) => ({
  entity,
  operation,
  rows,
  sequence: 9999,
  scope: 'default',
  path: `${entity}_test_${operation}`,
});

async function main() {
  const snapshotPath = path.resolve(
    'src/database/migration/.snapshot-sapling.json',
  );
  const snapshotBefore = fs.readFileSync(snapshotPath, 'utf8');
  process.env.DB_DATA_SEEDER = 'production';
  process.env.DB_BASELINE_ADOPT = 'false';
  const dbName = 'sapling_baseline_production_fresh_test';
  const owned = JSON.parse(
    fs.readFileSync(path.join(output, 'test-databases.json'), 'utf8'),
  );
  assert.ok(owned.includes(dbName));
  const orm = await MikroORM.init({ ...config, dbName, debug: false });
  let assertions = 0;
  const rollback = new Error('intentional test rollback');
  const isolated = async (callback) => {
    try {
      await orm.em.fork().transactional(async (em) => {
        await callback(em);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  };
  try {
    await isolated(async (em) => {
      const key = {
        entity: '__baseline_test',
        property: 'label',
        language: 'de',
      };
      assert.equal(
        (
          await executeSeedFile(
            em,
            seed('translation', 'insert', [{ ...key, value: 'Original' }]),
          )
        ).inserted,
        1,
      );
      assert.equal(
        (
          await executeSeedFile(
            em,
            seed('translation', 'insert', [{ ...key, value: 'Changed' }]),
          )
        ).skipped,
        1,
      );
      assert.equal(
        (await em.findOneOrFail(TranslationItem, key)).value,
        'Original',
      );
      assert.equal(
        (
          await executeSeedFile(
            em,
            seed('translation', 'update', [
              { key, values: { value: 'Updated' } },
            ]),
          )
        ).updated,
        1,
      );
      assert.equal(
        (await em.findOneOrFail(TranslationItem, key)).value,
        'Updated',
      );
      assert.equal(
        (await executeSeedFile(em, seed('translation', 'delete', [{ key }])))
          .deleted,
        1,
      );
      assert.equal(
        (
          await executeSeedFile(
            em,
            seed('translation', 'update', [
              { key, values: { value: 'Absent' } },
            ]),
          )
        ).skipped,
        1,
      );
      assert.equal(
        (await executeSeedFile(em, seed('translation', 'delete', [{ key }])))
          .skipped,
        1,
      );
      assertions += 8;
    });
    await isolated(async (em) => {
      const permission = await em.findOneOrFail(PermissionItem, {
        entity: 'ticket',
        role: 1,
      });
      permission.allowRead = false;
      await em.flush();
      await executeSeedFile(
        em,
        seed('permission', 'insert', [
          {
            entity: 'ticket',
            role: 1,
            allowRead: true,
            allowInsert: true,
            allowUpdate: true,
            allowDelete: true,
            allowShow: true,
          },
        ]),
      );
      assert.equal(
        (await em.findOneOrFail(PermissionItem, { entity: 'ticket', role: 1 }))
          .allowRead,
        false,
      );
      assertions++;
    });
    await assert.rejects(
      isolated((em) =>
        executeSeedFile(
          em,
          seed('translation', 'insert', [
            {
              entity: '__baseline_test',
              property: 'bad',
              language: '__missing_language',
              value: 'Invalid',
            },
          ]),
        ),
      ),
      /foreign key/i,
    );
    assertions++;
    await assert.rejects(
      isolated(async (em) => {
        const version = await em.findOneOrFail(AiPromptVersionItem, {
          handle: 1,
        });
        await executeSeedFile(
          em,
          seed('aiPromptVersion', 'update', [
            {
              key: { handle: version.handle },
              values: { content: version.content + '\nChanged.' },
            },
          ]),
        );
      }),
      /immutable/i,
    );
    assertions++;
    await assert.rejects(
      isolated(async (em) => {
        const version = await em.findOneOrFail(AiPromptVersionItem, {
          handle: 1,
        });
        await executeSeedFile(
          em,
          seed('aiPromptVersion', 'delete', [
            { key: { handle: version.handle } },
          ]),
        );
      }),
      /immutable/i,
    );
    assertions++;
    const testDir = path.resolve('dist/database/seeder/json-default/language');
    const orderPath = path.resolve('dist/database/seeder/seed-order.json');
    const originalOrder = fs.readFileSync(orderPath, 'utf8');
    const register = (...names) =>
      fs.writeFileSync(
        orderPath,
        JSON.stringify(
          [
            ...JSON.parse(originalOrder),
            ...names.map((name) => `json-default/language/${name}`),
          ],
          null,
          2,
        ),
      );
    const first = path.join(testDir, 'languageData_9998_insert.json');
    const last = path.join(testDir, 'languageData_9999_update.json');
    assert.ok(!fs.existsSync(first) && !fs.existsSync(last));
    const historyBefore = await orm.em
      .fork()
      .getConnection()
      .execute('select * from seed_script_item order by handle');
    fs.writeFileSync(
      first,
      JSON.stringify([{ handle: '__rollback_test', name: 'Rollback' }]),
    );
    fs.writeFileSync(
      last,
      JSON.stringify([{ key: {}, values: { name: 'Invalid' } }]),
    );
    try {
      register(path.basename(first), path.basename(last));
      await assert.rejects(
        new DatabaseSeeder().run(orm.em.fork()),
        (error) =>
          /Seed failed/.test(error.message) &&
          /Unsupported seed key/.test(error.cause?.message),
      );
      assert.equal(
        await orm.em.fork().count(LanguageItem, { handle: '__rollback_test' }),
        0,
      );
      const after = await orm.em
        .fork()
        .getConnection()
        .execute('select * from seed_script_item order by handle');
      assert.deepEqual(after, historyBefore);
      assertions += 3;
    } finally {
      fs.writeFileSync(orderPath, originalOrder);
      fs.unlinkSync(first);
      fs.unlinkSync(last);
    }
    const newSeed = path.join(testDir, 'languageData_9999_insert.json');
    assert.ok(!fs.existsSync(newSeed));
    fs.writeFileSync(
      newSeed,
      JSON.stringify([{ handle: '__future_test', name: 'Future' }]),
    );
    try {
      register(path.basename(newSeed));
      process.env.DB_BASELINE_ADOPT = 'true';
      await prepareDatabaseBaseline(orm.em.fork(), 'all');
      await new DatabaseSeeder().run(orm.em.fork());
      assert.equal(
        await orm.em.fork().count(LanguageItem, { handle: '__future_test' }),
        1,
      );
      const after = await orm.em
        .fork()
        .getConnection()
        .execute('select * from seed_script_item order by handle');
      assert.equal(after.length, historyBefore.length + 1);
      assert.deepEqual(after.slice(0, historyBefore.length), historyBefore);
      await prepareDatabaseBaseline(orm.em.fork(), 'all');
      await new DatabaseSeeder().run(orm.em.fork());
      assert.deepEqual(
        await orm.em
          .fork()
          .getConnection()
          .execute('select * from seed_script_item order by handle'),
        after,
      );
      assertions += 3;
    } finally {
      fs.writeFileSync(orderPath, originalOrder);
      fs.unlinkSync(newSeed);
    }
    process.env.DB_BASELINE_ADOPT = 'false';
    const migrationPath = path.resolve(
      'dist/database/migration/Migration20990101000000.js',
    );
    assert.ok(!fs.existsSync(migrationPath));
    fs.writeFileSync(
      migrationPath,
      "const { Migration } = require('@mikro-orm/migrations'); exports.Migration20990101000000 = class Migration20990101000000 extends Migration { up() { this.addSql('create table baseline_future_test (handle integer primary key)'); } };\n",
    );
    try {
      process.env.DB_BASELINE_ADOPT = 'true';
      await prepareDatabaseBaseline(orm.em.fork(), 'all');
      await orm.migrator.up();
      const migrations = await orm.em
        .fork()
        .getConnection()
        .execute('select name from mikro_orm_migrations order by name');
      assert.deepEqual(
        migrations.map((row) => row.name),
        ['Migration20260708104812', 'Migration20990101000000'],
      );
      await prepareDatabaseBaseline(orm.em.fork(), 'all');
      assert.deepEqual(
        await orm.em
          .fork()
          .getConnection()
          .execute('select name from mikro_orm_migrations order by name'),
        migrations,
      );
      assertions += 2;
      const futureDb = 'sapling_baseline_production_future_test';
      const client = orm.em.fork().getConnection();
      const exists = await client.execute(
        'select 1 from pg_database where datname = ?',
        [futureDb],
      );
      if (exists.length) {
        assert.ok(
          owned.includes(futureDb),
          'Refusing to replace an unowned database',
        );
        await client.execute(
          'drop database "sapling_baseline_production_future_test"',
        );
      }
      await client.execute(
        'create database "sapling_baseline_production_future_test"',
      );
      if (!owned.includes(futureDb)) owned.push(futureDb);
      fs.writeFileSync(
        path.join(output, 'test-databases.json'),
        JSON.stringify(owned, null, 2),
      );
      process.env.DB_BASELINE_ADOPT = 'false';
      const futureOrm = await MikroORM.init({
        ...config,
        dbName: futureDb,
        debug: false,
      });
      try {
        await prepareDatabaseBaseline(futureOrm.em.fork(), 'all');
        await futureOrm.migrator.up();
        await futureOrm.seeder.seed(DatabaseSeeder);
        assert.equal(
          (
            await futureOrm.em
              .fork()
              .getConnection()
              .execute('select name from mikro_orm_migrations')
          ).length,
          2,
        );
        assert.equal(
          (
            await futureOrm.em
              .fork()
              .getConnection()
              .execute(
                "select * from seed_script_item where entity_handle='__baseline'",
              )
          ).length,
          1,
        );
        assertions += 2;
      } finally {
        await futureOrm.close(true);
      }
    } finally {
      fs.unlinkSync(migrationPath);
    }
    process.env.DB_BASELINE_ADOPT = 'false';
    // Explicit IDs advance serial sequences; subsequent ordinary inserts must not collide.
    await isolated(async (em) => {
      const [{ max }] = await em
        .getConnection()
        .execute('select max(handle)::int as max from translation_item');
      const handle = max + 100;
      await executeSeedFile(
        em,
        seed('translation', 'insert', [
          {
            handle,
            entity: '__sequence_test',
            property: 'explicit',
            language: 'de',
            value: 'Explicit',
          },
        ]),
      );
      const row = em.create(TranslationItem, {
        entity: '__sequence_test',
        property: 'automatic',
        language: 'de',
        value: 'Automatic',
      });
      em.persist(row);
      await em.flush();
      assert.ok(row.handle > handle);
      assertions++;
    });
    process.env.DB_DATA_SEEDER = 'demonstration';
    await assert.rejects(
      prepareDatabaseBaseline(orm.em.fork(), 'all'),
      /mismatch/i,
    );
    assertions++;
    console.log(
      JSON.stringify({
        database: dbName,
        assertions,
        rollback: true,
        constraints: true,
        futureSeedWithAdoptFlag: true,
        sequences: true,
      }),
    );
    assert.equal(
      fs.readFileSync(snapshotPath, 'utf8'),
      snapshotBefore,
      'Future-migration tests must not rewrite the shared snapshot',
    );
    fs.writeFileSync(
      path.join(output, 'operation-verification.json'),
      JSON.stringify({ assertions, passed: true }, null, 2),
    );
  } finally {
    await orm.close(true);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
