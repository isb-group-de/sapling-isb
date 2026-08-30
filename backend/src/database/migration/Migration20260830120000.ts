import { Migration } from '@mikro-orm/migrations';

export class Migration20260830120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "event_item" add column "recurrence_exception_dates" jsonb not null default '[]'::jsonb;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "event_item" drop column "recurrence_exception_dates";`,
    );
  }
}
