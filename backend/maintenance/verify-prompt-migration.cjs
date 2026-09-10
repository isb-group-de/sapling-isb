// Run from repository root. Only a uniquely named disposable local database is changed.
const { Client } = require('../node_modules/pg');
const assert = require('node:assert/strict');
const path = require('node:path');
require('../node_modules/dotenv').config({ path: 'backend/.env', quiet: true });
require('reflect-metadata');

async function main() {
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
    throw Error('This verification requires a local PostgreSQL server.');
  }
  process.env.DB_DATA_SEEDER = 'production';
  process.env.DB_BASELINE_ADOPT = 'false';
  global.log = { info() {}, debug() {}, warn() {}, error() {} };
  const database = `sapling_codex_prompt_test_${Date.now()}`;
  const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const admin = new Client({ ...options, database: process.env.DB_NAME });
  let created = false,
    client,
    orm;
  await admin.connect();
  try {
    assert.match(database, /^sapling_codex_prompt_test_[0-9]+$/);
    assert.notEqual(database, process.env.DB_NAME);
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    client = new Client({ ...options, database });
    await client.connect();
    const { MikroORM } = require('../node_modules/@mikro-orm/postgresql');
    const config = require('../dist/database/mikro-orm.config').default;
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
      allowGlobalContext: true,
      debug: false,
      pool: { min: 0, max: 2 },
    });
    await orm.migrator.up();
    const {
      DatabaseSeeder,
    } = require('../dist/database/seeder/DatabaseSeeder');
    const {
      AiPromptService,
    } = require('../dist/api/ai/prompts/ai-prompt.service');
    const {
      AiPromptTemplateItem,
    } = require('../dist/entity/AiPromptTemplateItem');
    const {
      AiPromptVersionItem,
    } = require('../dist/entity/AiPromptVersionItem');
    await new DatabaseSeeder().run(orm.em.fork());
    const count = Number(
      (await client.query('select count(*) from ai_prompt_version_item'))
        .rows[0].count,
    );
    assert.ok(count >= 190);
    const em = orm.em.fork();
    const service = new AiPromptService(em);
    const template = await em.findOneOrFail(AiPromptTemplateItem, {
      handle: 'chat.ai_system_prompt_base',
    });
    const original = template.publishedVersion.handle;
    template.draft = 'Individually maintained instructions';
    await em.flush();
    const published = await service.publish(
      template.handle,
      { handle: 1 },
      'verification',
    );
    assert.equal(published.version, 2);
    assert.equal(
      (await service.load({ [template.handle]: original })).prompts[
        template.handle
      ].content.includes('Sapling'),
      true,
    );
    await assert.rejects(
      client.query(
        'update ai_prompt_version_item set content=$1 where handle=$2',
        ['tampered', published.handle],
      ),
      /immutable/,
    );
    await assert.rejects(
      client.query('delete from ai_prompt_version_item where handle=$1', [
        published.handle,
      ]),
      /immutable/,
    );
    const restored = await service.publish(
      template.handle,
      { handle: 1 },
      'restore',
      original,
    );
    assert.equal(restored.version, 3);
    assert.equal(
      (
        await em.findOneOrFail(AiPromptVersionItem, {
          handle: published.handle,
        })
      ).content,
      'Individually maintained instructions',
    );
    await new DatabaseSeeder().run(orm.em.fork());
    assert.equal(
      Number(
        (await client.query('select count(*) from ai_prompt_version_item'))
          .rows[0].count,
      ),
      count + 2,
    );
    await orm.migrator.down();
    assert.equal(
      (
        await client.query(
          "select to_regclass('public.ai_prompt_template_item') as table_name",
        )
      ).rows[0].table_name,
      null,
    );
    console.log(
      JSON.stringify({
        migration: 'baseline up/down passed',
        seededPrompts: count,
        publication: 'passed',
        restore: 'passed',
        immutableVersions: 'passed',
        idempotentSeeder: 'passed',
        sourceDatabase: 'unchanged',
      }),
    );
  } finally {
    if (orm) await orm.close(true);
    if (client) await client.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
