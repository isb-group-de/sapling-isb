import { Migration } from '@mikro-orm/migrations';

export class Migration20260907120000 extends Migration {
  override up(): void {
    // NULL keeps existing KPI assignments readable until a workspace is edited.
    this.addSql(
      'alter table "dashboard_item" add column "widgets" jsonb null;',
    );
    this.addSql(
      'alter table "dashboard_template_item" add column "widgets" jsonb null;',
    );
  }
  override down(): void {
    this.addSql('alter table "dashboard_template_item" drop column "widgets";');
    this.addSql('alter table "dashboard_item" drop column "widgets";');
  }
}
