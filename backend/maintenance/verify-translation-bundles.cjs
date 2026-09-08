// Read-only verification against the configured restored database; run from repository root.
const assert = require('node:assert/strict');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
require('../node_modules/dotenv').config({ path: 'backend/.env', quiet: true });
async function main() {
  const { MikroORM } = require('../node_modules/@mikro-orm/postgresql');
  const config = require('../dist/database/mikro-orm.config').default;
  const { TranslationItem } = require('../dist/entity/TranslationItem');
  const { TranslationBundleService } = require('../dist/api/template/translation-bundle.service');
  const orm = await MikroORM.init({ ...config, entities: [path.resolve('backend/dist/entity/*.js')], entitiesTs: [], debug: false });
  try {
    const result = await orm.em.fork().transactional(async (em) => {
      await em.getConnection().execute('SET TRANSACTION READ ONLY');
      const rows = await em.find(TranslationItem, { language: { handle: 'de' } }, { fields: ['entity', 'property', 'value'] });
      const names = [...new Set(rows.map((row) => row.entity))].sort();
      const expected = Object.fromEntries(rows.map((row) => [`${row.entity}.${row.property}`, row.value]));
      const actual = {};
      let requests = 0, bytes = 0;
      const service = new TranslationBundleService(em);
      const started = performance.now();
      for (let index = 0; index < names.length; index += 100) {
        const bundle = await service.load('de', names.slice(index, index + 100).join(','));
        for (const [entity, entries] of Object.entries(bundle.messages))
          for (const [key, value] of Object.entries(entries)) actual[`${entity}.${key}`] = value;
        bytes += Buffer.byteLength(JSON.stringify({ messages: bundle.messages }));
        requests++;
      }
      assert.deepEqual(actual, expected);
      const legacyRequests = names.reduce((total, name) => total + Math.ceil(rows.filter((row) => row.entity === name).length / 100), 0);
      return { readOnly: true, language: 'de', keys: rows.length, namespaces: names.length, bundleRequests: requests, legacyPaginatedRequests: legacyRequests, compactJsonBytes: bytes, verificationDurationMs: Math.round(performance.now() - started), note: 'Duration is an isolated service check, not a controlled before/after HTTP or LCP benchmark.' };
    });
    console.log(JSON.stringify(result));
  } finally { await orm.close(true); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
