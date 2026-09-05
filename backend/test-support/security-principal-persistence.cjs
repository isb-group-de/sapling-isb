// Offline regression using the real entity metadata and MikroORM UnitOfWork.
// No database connection, flush, schema changes, or application startup.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { MikroORM } = require('@mikro-orm/postgresql');
const { ReflectMetadataProvider } = require('@mikro-orm/decorators/legacy');
const { PersonItem } = require('../src/entity/PersonItem.ts');
const { AutomationEventItem } = require('../src/entity/AutomationEventItem.ts');
const { EntityItem } = require('../src/entity/EntityItem.ts');
const {
  SecurityPrincipalCacheService,
} = require('../src/api/current/security-principal-cache.service.ts');
const { CurrentService } = require('../src/api/current/current.service.ts');
const {
  AutomationEventService,
} = require('../src/api/automation/automation-event.service.ts');
const {
  GenericSanitizerService,
} = require('../src/api/generic/generic-sanitizer.service.ts');

async function main() {
  const orm = await MikroORM.init({
    entities: [PersonItem, AutomationEventItem],
    metadataProvider: ReflectMetadataProvider,
    dbName: 'offline-principal-regression',
    connect: false,
    debug: false,
  });
  try {
    const selects = [];
    orm.em.getConnection().execute = async (sql) => {
      assert.equal(typeof sql, 'string');
      assert.match(sql, /^select /i, 'Only synthetic read queries are allowed');
      selects.push(sql);
      if (!sql.includes('from "person_item"')) return [];
      return [
        {
          handle: 7,
          first_name: 'Test',
          last_name: 'Person',
          ...(sql.includes('"login_password"')
            ? { login_password: 'synthetic-hash' }
            : {}),
        },
      ];
    };

    const cache = new SecurityPrincipalCacheService(orm.em);
    const current = new CurrentService(orm.em, {});
    for (const load of [
      () => cache.get(7),
      () => current.getPerson({ handle: 7 }),
      () => current.getPersonWithStarterWorkspace({ handle: 7 }),
    ]) {
      const principal = await load();
      assert.ok(principal);
      assert.equal(principal.loginPassword, undefined);
      const personQueries = selects.filter((sql) =>
        sql.includes('from "person_item"'),
      );
      assert.ok(personQueries.length);
      assert.ok(!personQueries.at(-1).includes('"login_password"'));

      // Even another writer that attaches the whole principal must not see a
      // password deletion. This covers the common source beyond automations.
      const em = orm.em.fork();
      const event = em.create(AutomationEventItem, {
        sourceEntity: 'ticket',
        sourceHandle: '99',
        operation: 'afterUpdate',
        actor: principal,
      });
      em.persist(event);
      em.getUnitOfWork().computeChangeSets();
      assert.deepEqual(
        em
          .getUnitOfWork()
          .getChangeSets()
          .map((change) => change.entity.constructor.name),
        ['AutomationEventItem'],
      );
    }

    // A stale or deliberately modified principal must never be cascaded by
    // any automation operation, regardless of the current loading strategy.
    for (const operation of [
      'afterInsert',
      'afterUpdate',
      'afterDelete',
      'addReference',
      'deleteReference',
    ]) {
      const securityEm = orm.em.fork();
      const actor = securityEm.map(PersonItem, {
        handle: 7,
        login_password: 'synthetic-hash',
        last_name: 'Original',
      });
      delete actor.loginPassword;
      actor.lastName = 'Unintended change';
      const em = orm.em.fork();
      em.findOne = async () => em.getReference(EntityItem, 'ticket');
      em.flush = async () => {
        em.getUnitOfWork().computeChangeSets();
        const changes = em.getUnitOfWork().getChangeSets();
        assert.equal(changes.length, 1);
        assert.equal(changes[0].entity.constructor.name, 'AutomationEventItem');
        assert.equal(changes[0].payload.actor, 7);
      };
      const service = new AutomationEventService(em);
      await service.record({
        entityHandle: 'ticket',
        sourceHandle: '99',
        operation,
        actor,
      });
    }

    // Generic response redaction must also preserve the managed source, even
    // when a password-bearing person is nested inside another record.
    const em = orm.em.fork();
    const person = em.map(PersonItem, {
      handle: 7,
      login_password: 'synthetic-hash',
      last_name: 'Original',
    });
    const templates = {
      person: [
        { name: 'handle', options: [] },
        { name: 'loginPassword', options: ['isSecurity'] },
      ],
      ticket: [
        { name: 'creatorPerson', isReference: true, referenceName: 'person' },
      ],
    };
    const sanitizer = new GenericSanitizerService({
      getEntityTemplate: (entity) => templates[entity],
    });
    const response = sanitizer.sanitizeEntityResult('ticket', {
      creatorPerson: person,
    });
    assert.equal(response.creatorPerson.loginPassword, undefined);
    assert.equal(person.loginPassword, 'synthetic-hash');
    em.getUnitOfWork().computeChangeSets();
    assert.equal(em.getUnitOfWork().getChangeSets().length, 0);

    // Positive control: the real tracker does detect the historical failure.
    delete person.loginPassword;
    em.getUnitOfWork().computeChangeSets();
    assert.ok(
      em
        .getUnitOfWork()
        .getChangeSets()
        .some(
          (change) =>
            change.entity === person &&
            Object.hasOwn(change.payload, 'loginPassword'),
        ),
    );
  } finally {
    await orm.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
