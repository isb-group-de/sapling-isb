import { Migration } from '@mikro-orm/migrations';

export class Migration20260706120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "person_item" alter column "first_name" drop not null;`,
    );
    this.addSql(
      `alter table "custom_field_value_item" alter column "value_boolean" set default false;`,
    );
  }

  override down(): void {
    this.addSql(
      `update "person_item" set "first_name" = '' where "first_name" is null;`,
    );
    this.addSql(
      `alter table "person_item" alter column "first_name" set not null;`,
    );
    this.addSql(
      `alter table "custom_field_value_item" alter column "value_boolean" drop default;`,
    );
  }
}
