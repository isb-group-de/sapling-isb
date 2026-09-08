// Uses a disposable, uniquely named local database. Never migrates the supplied database.
const { Client } = require('../node_modules/pg');
const assert = require('node:assert/strict');
const path = require('node:path');
require('../node_modules/dotenv').config({ path: 'backend/.env', quiet: true });
async function main() {
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) throw Error('This verification requires a local PostgreSQL server.');
  const database = `sapling_codex_prompt_test_${Date.now()}`;
  const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  const admin = new Client({ ...options, database: process.env.DB_NAME });
  let created = false, client, orm;
  await admin.connect();
  try {
    assert.match(database, /^sapling_codex_prompt_test_[0-9]+$/);
    assert.notEqual(database, process.env.DB_NAME);
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    client = new Client({ ...options, database }); await client.connect();
    for (const table of ['email_delivery_item','event_delivery_item','person_item','inbound_email_item','ai_agent_run_item','ai_provider_model_item','ai_chat_session_item','ai_agent_evaluation_item','automation_execution_item']) await client.query(`CREATE TABLE ${table} (handle serial primary key)`);
    await client.query(`CREATE TABLE seed_script_item (handle serial primary key, script_name varchar(256) not null, entity_handle varchar(64) not null, executed_at timestamptz not null, is_success boolean not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
    const { Migration20260908120000 } = require('../dist/database/migration/Migration20260908120000');
    const migration = new Migration20260908120000(); await migration.up();
    await client.query('BEGIN');
    for (const query of migration.getQueries()) await client.query(query);
    await client.query('COMMIT');
    const { MikroORM } = require('../node_modules/@mikro-orm/postgresql');
    const config = require('../dist/database/mikro-orm.config').default;
    orm = await MikroORM.init({ ...config, ...options, dbName: database, entities: [path.resolve('backend/dist/entity/*.js')], entitiesTs: [], allowGlobalContext: true, debug: false, pool: { min: 0, max: 2 } });
    const { AiPromptSeeder } = require('../dist/database/seeder/AiPromptSeeder');
    const { AiPromptService } = require('../dist/api/ai/prompts/ai-prompt.service');
    const { AiPromptTemplateItem } = require('../dist/entity/AiPromptTemplateItem');
    const { AiPromptVersionItem } = require('../dist/entity/AiPromptVersionItem');
    const em = orm.em.fork(); const seeder = new AiPromptSeeder();
    await seeder.run(em);
    const count = Number((await client.query('select count(*) from ai_prompt_version_item')).rows[0].count);
    assert.ok(count >= 190);
    await client.query('insert into person_item(handle) values (1)');
    const service = new AiPromptService(em);
    const template = await em.findOneOrFail(AiPromptTemplateItem, { handle: 'chat.ai_system_prompt_base' });
    const original = template.publishedVersion.handle;
    template.draft = 'Individually maintained instructions'; await em.flush();
    const published = await service.publish(template.handle, { handle: 1 }, 'verification');
    assert.equal(published.version, 2);
    assert.equal((await service.load({ [template.handle]: original })).prompts[template.handle].content.includes('Sapling'), true);
    // Even direct SQL cannot silently mutate or delete an already published version.
    await assert.rejects(client.query('update ai_prompt_version_item set content=$1 where handle=$2', ['tampered', published.handle]), /immutable/);
    await assert.rejects(client.query('delete from ai_prompt_version_item where handle=$1', [published.handle]), /immutable/);
    const restored = await service.publish(template.handle, { handle: 1 }, 'restore', original);
    assert.equal(restored.version, 3);
    assert.equal((await em.findOneOrFail(AiPromptVersionItem, { handle: published.handle })).content, 'Individually maintained instructions');
    await seeder.run(em);
    assert.equal(Number((await client.query('select count(*) from ai_prompt_version_item')).rows[0].count), count + 2);
    await orm.close(true); orm = null;
    migration.reset(); await migration.down();
    for (const query of migration.getQueries()) await client.query(query);
    console.log(JSON.stringify({ migration: 'up/down passed', seededPrompts: count, publication: 'passed', restore: 'passed', immutableVersions: 'passed', idempotentSeeder: 'passed', sourceDatabase: 'unchanged' }));
  } finally {
    if (orm) await orm.close(true);
    if (client) await client.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
