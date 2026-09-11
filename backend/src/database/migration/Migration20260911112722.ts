import { Migration } from '@mikro-orm/migrations';

export class Migration20260911112722 extends Migration {
  override name = 'Migration20260911112722';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "calendar_sync_subscription_item" add "outlook_availability_mappings" jsonb not null default '[]';`,
    );

    this.addSql(
      `alter table "event_item" add "is_outlook_available" boolean not null default false;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "calendar_sync_subscription_item" drop column "outlook_availability_mappings";`,
    );

    this.addSql(`alter table "event_item" drop column "is_outlook_available";`);
  }
}
