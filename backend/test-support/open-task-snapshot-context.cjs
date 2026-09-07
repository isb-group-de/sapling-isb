// Exercise real MikroORM context resolution without connecting to a database.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { MikroORM } = require('@mikro-orm/postgresql');
const { RequestContext, TransactionContext } = require('@mikro-orm/core');
const { ReflectMetadataProvider } = require('@mikro-orm/decorators/legacy');
const { TicketItem } = require('../src/entity/TicketItem.ts');
const { EventItem } = require('../src/entity/EventItem.ts');
const {
  SalesOpportunityItem,
} = require('../src/entity/SalesOpportunityItem.ts');
const { EffortEstimateItem } = require('../src/entity/EffortEstimateItem.ts');
const { InternalCaseItem } = require('../src/entity/InternalCaseItem.ts');
const {
  InboxNotificationItem,
} = require('../src/entity/InboxNotificationItem.ts');
const { CurrentService } = require('../src/api/current/current.service.ts');
const { InboxService } = require('../src/api/inbox/inbox.service.ts');
const {
  OpenTaskEventsService,
} = require('../src/api/current/open-task-events.service.ts');
const {
  latestSnapshotOnChange,
} = require('../src/api/current/open-task-snapshot-stream.ts');

async function main() {
  const orm = await MikroORM.init({
    entities: [
      TicketItem,
      EventItem,
      SalesOpportunityItem,
      EffortEstimateItem,
      InternalCaseItem,
      InboxNotificationItem,
    ],
    metadataProvider: ReflectMetadataProvider,
    dbName: 'offline-inbox-context-regression',
    connect: false,
    debug: false,
  });
  const events = new OpenTaskEventsService();
  const current = new CurrentService(
    orm.em,
    new InboxService(orm.em, {}, events),
  );
  const user = { handle: 7 };
  const writer = orm.em.fork();
  const transaction = { committed: false };
  writer.setTransactionContext(transaction);
  let reads = 0;
  let notificationReads = 0;
  orm.em.getConnection().execute = async (sql, params, method, ctx) => {
    assert.match(sql, /^select /i, 'Only synthetic reads are allowed');
    if (ctx?.committed) throw new Error('Transaction is already committed');
    assert.equal(
      ctx,
      undefined,
      'Snapshots must not join the triggering transaction',
    );
    reads++;
    if (sql.includes('from "inbox_notification_item"')) notificationReads++;
    return [];
  };
  let subscription;
  try {
    // Positive control: ambient transaction context propagates through timers.
    transaction.committed = true;
    await TransactionContext.create(writer, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      await assert.rejects(
        () => current.getOpenTickets(user),
        /Transaction is already committed/,
      );
    });

    let received = 0;
    let next;
    let failed;
    const waitForSnapshot = () =>
      new Promise((resolve, reject) => {
        next = resolve;
        failed = reject;
      });
    const initial = waitForSnapshot();
    RequestContext.create(orm.em, () => {
      subscription = events
        .streamForUser(user.handle)
        .pipe(latestSnapshotOnChange(() => current.getOpenTaskSnapshot(user)))
        .subscribe({
          next: (snapshot) => {
            received++;
            next(snapshot);
          },
          error: (error) => failed(error),
        });
    });
    assert.equal((await initial).count, 0);
    for (let index = 0; index < 2; index++) {
      const refreshed = waitForSnapshot();
      await TransactionContext.create(writer, async () => {
        transaction.committed = false;
        events.notifyUsers([user.handle]);
        transaction.committed = true;
        // A referenced timer keeps the process alive for the service's unref timer.
        await Promise.all([
          refreshed,
          new Promise((resolve) => setTimeout(resolve, 40)),
        ]);
      });
    }
    assert.equal(received, 3);
    assert.equal(
      reads,
      18,
      'Every refresh must reload all six snapshot sections',
    );
    assert.equal(
      notificationReads,
      3,
      'Notifications must share the isolated reads',
    );
  } finally {
    subscription?.unsubscribe();
    events.onApplicationShutdown();
    await orm.close();
  }
}

// A missing refresh must fail instead of letting Node exit with a pending promise.
const timeout = setTimeout(() => {
  console.error('Timed out waiting for the inbox snapshot regression');
  process.exitCode = 1;
}, 20_000);
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
