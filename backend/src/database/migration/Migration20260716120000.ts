import { Migration } from '@mikro-orm/migrations';

export class Migration20260716120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "custom_field_definition_item" add column "is_read_only" boolean not null default false;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "custom_field_definition_item" drop column if exists "is_read_only";`,
    );
  }
}
