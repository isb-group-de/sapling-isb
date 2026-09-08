// Read-only integration check against the supplied configuration, without processing events.
const assert = require('node:assert/strict');
const path = require('node:path');
require('../node_modules/dotenv').config({ path: 'backend/.env', quiet: true });
async function main() {
  const { MikroORM } = require('../node_modules/@mikro-orm/postgresql');
  const config = require('../dist/database/mikro-orm.config').default;
  const { AutomationInspectionService } = require('../dist/api/automation/automation-inspection.service');
  const orm = await MikroORM.init({ ...config, entities: [path.resolve('backend/dist/entity/*.js')], entitiesTs: [], debug: false, pool: { min: 0, max: 2 } });
  try {
    await orm.em.fork().transactional(async em => {
      await em.getConnection().execute('SET TRANSACTION READ ONLY', [], 'all', em.getTransactionContext());
      const graph = await new AutomationInspectionService(em).graph('ticket', 2, false);
      const rules = [...new Map(graph.nodes.filter(node => node.rule).map(node => [node.rule.id, node.rule])).values()];
      const matching = rules.filter(rule => rule.sourceEntity === 'document' && rule.targetEntity === 'ticket');
      assert.ok(matching.some(rule => rule.kind === 'field' && rule.conditions.length && rule.assignments.some(a => a.field === 'status')));
      assert.ok(matching.some(rule => rule.kind === 'inbox'));
      assert.ok(graph.nodes.some(node => node.id === 'event:document:afterInsert'));
      assert.ok(graph.nodes.some(node => node.id === 'event:ticket:afterUpdate'));
      assert.ok(graph.nodes.length <= 200);
      console.log(JSON.stringify({ readOnly: true, nodes: graph.nodes.length, edges: graph.edges.length, documentToTicketRuleKinds: matching.map(rule => rule.kind), followupEvent: true, truncated: graph.truncated }));
    });
  } finally { await orm.close(true); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
