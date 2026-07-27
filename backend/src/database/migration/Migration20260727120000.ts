import { Migration } from '@mikro-orm/migrations';

export class Migration20260727120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "event_item" add column "preparation_duration" time not null default '00:00:00', add column "follow_up_duration" time not null default '00:00:00';`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "event_item" drop column if exists "preparation_duration", drop column if exists "follow_up_duration";`,
    );
  }
}
