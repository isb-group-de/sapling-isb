import { Migration } from '@mikro-orm/migrations';

export class Migration20260708120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "entity_route_item" add column "group_handle" varchar(64) null;`,
    );
    this.addSql(
      `alter table "entity_route_item" add constraint "entity_route_item_group_handle_foreign" foreign key ("group_handle") references "entity_group_item" ("handle") on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "entity_route_item" drop constraint "entity_route_item_group_handle_foreign";`,
    );
    this.addSql(`alter table "entity_route_item" drop column "group_handle";`);
  }
}
