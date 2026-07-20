import { Migration } from '@mikro-orm/migrations';

export class Migration20260720120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "email_subscription_item" add column "sender_mailbox_handle" int null;`,
    );
    this.addSql(
      `create index "email_subscription_item_sender_mailbox_handle_index" on "email_subscription_item" ("sender_mailbox_handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_sender_mailbox_handle_foreign" foreign key ("sender_mailbox_handle") references "shared_mailbox_item" ("handle");`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "email_subscription_item" drop constraint if exists "email_subscription_item_sender_mailbox_handle_foreign";`,
    );
    this.addSql(
      `drop index if exists "email_subscription_item_sender_mailbox_handle_index";`,
    );
    this.addSql(
      `alter table "email_subscription_item" drop column if exists "sender_mailbox_handle";`,
    );
  }
}
