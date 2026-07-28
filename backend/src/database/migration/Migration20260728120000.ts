import { Migration } from '@mikro-orm/migrations';

export class Migration20260728120000 extends Migration {
  override up(): void {
    this.addSql('create extension if not exists "pg_trgm";');
    this.addSql(
      `create table "global_search_index_item" (
        "handle" serial primary key,
        "entity_handle" varchar(64) not null,
        "record_handle" varchar(128) not null,
        "field_path" varchar(128) not null,
        "field_value" text not null,
        "normalized_value" text not null,
        "source_updated_at" timestamptz not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null
      );`,
    );
    this.addSql(
      `alter table "global_search_index_item"
       add constraint "global_search_index_item_record_field_unique"
       unique ("entity_handle", "record_handle", "field_path");`,
    );
    this.addSql(
      `create index "global_search_index_item_scope_idx"
       on "global_search_index_item" ("entity_handle", "field_path");`,
    );
    this.addSql(
      `create index "global_search_index_item_value_trgm_idx"
       on "global_search_index_item"
       using gin ("normalized_value" gin_trgm_ops);`,
    );
  }

  override down(): void {
    this.addSql('drop table if exists "global_search_index_item" cascade;');
  }
}
