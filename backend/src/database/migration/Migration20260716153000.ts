import { Migration } from '@mikro-orm/migrations';

export class Migration20260716153000 extends Migration {
  override up(): void {
    this.addSql(
      `create table "field_permission_item" ("handle" serial primary key, "permission_handle" int not null, "field_name" varchar(128) not null, "allow_read" boolean not null default true, "allow_insert" boolean not null default true, "allow_update" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "field_permission_item" add constraint "field_permission_item_permission_handle_field_name_unique" unique ("permission_handle", "field_name");`,
    );
    this.addSql(
      `create index "field_permission_item_permission_handle_index" on "field_permission_item" ("permission_handle");`,
    );
    this.addSql(
      `alter table "field_permission_item" add constraint "field_permission_item_permission_handle_foreign" foreign key ("permission_handle") references "permission_item" ("handle") on delete cascade;`,
    );
  }

  override down(): void {
    this.addSql(`drop table if exists "field_permission_item" cascade;`);
  }
}
