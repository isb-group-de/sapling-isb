import { Migration } from '@mikro-orm/migrations';

export class Migration20260905120000 extends Migration {
  override up(): void {
    this.addSql(
      'alter table "inbox_subscription_item" add column "notify_actor" boolean not null default false;',
    );
    // Preserve self-delivery for existing Teams subscriptions.
    this.addSql(
      'alter table "teams_subscription_item" add column "notify_actor" boolean not null default true;',
    );
    this.addSql(
      'alter table "teams_subscription_item" alter column "notify_actor" set default false;',
    );
  }

  override down(): void {
    this.addSql(
      'alter table "inbox_subscription_item" drop column "notify_actor";',
    );
    this.addSql(
      'alter table "teams_subscription_item" drop column "notify_actor";',
    );
  }
}
