import { Migration } from '@mikro-orm/migrations';

export class Migration20260824120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "custom_field_definition_item"
       add column "tooltip" text null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "custom_field_definition_item"
       drop column if exists "tooltip";`,
    );
  }
}
