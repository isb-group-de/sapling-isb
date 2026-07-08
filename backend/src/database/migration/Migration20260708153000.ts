import { Migration } from '@mikro-orm/migrations';

export class Migration20260708153000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "dvelop_connection_item" ("handle" serial primary key, "title" varchar(128) not null, "base_url" varchar(512) not null, "repository_handle" int null, "api_key" varchar(2048) null, "default_object_definition_handle" int null, "is_active" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "dvelop_connection_item_repository_handle_index" on "dvelop_connection_item" ("repository_handle");`,
    );
    this.addSql(
      `create index "dvelop_connection_item_default_object_definition_handle_index" on "dvelop_connection_item" ("default_object_definition_handle");`,
    );

    this.addSql(
      `create table "dvelop_repository_item" ("handle" serial primary key, "connection_handle" int not null, "title" varchar(256) not null, "dvelop_id" varchar(128) not null, "version" varchar(64) null, "is_default" boolean not null default false, "is_available" boolean not null default true, "last_synced_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "dvelop_repository_item_connection_handle_index" on "dvelop_repository_item" ("connection_handle");`,
    );
    this.addSql(
      `alter table "dvelop_repository_item" add constraint "dvelop_repository_item_connection_handle_dvelop_id_unique" unique ("connection_handle", "dvelop_id");`,
    );

    this.addSql(
      `create table "dvelop_object_definition_item" ("handle" serial primary key, "connection_handle" int not null, "title" varchar(256) not null, "dvelop_id" varchar(128) not null, "description" text null, "is_active" boolean not null default true, "last_synced_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "dvelop_object_definition_item_connection_handle_index" on "dvelop_object_definition_item" ("connection_handle");`,
    );
    this.addSql(
      `alter table "dvelop_object_definition_item" add constraint "dvelop_object_definition_item_connection_handle_dvelop_id_unique" unique ("connection_handle", "dvelop_id");`,
    );

    this.addSql(
      `create table "dvelop_property_item" ("handle" serial primary key, "connection_handle" int not null, "title" varchar(256) not null, "dvelop_id" varchar(128) not null, "data_type" varchar(64) null, "description" text null, "is_required" boolean not null default false, "is_multi_value" boolean not null default false, "is_active" boolean not null default true, "last_synced_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "dvelop_property_item_connection_handle_index" on "dvelop_property_item" ("connection_handle");`,
    );
    this.addSql(
      `alter table "dvelop_property_item" add constraint "dvelop_property_item_connection_handle_dvelop_id_unique" unique ("connection_handle", "dvelop_id");`,
    );

    this.addSql(
      `create table "dvelop_entity_mapping_item" ("handle" serial primary key, "connection_handle" int not null, "entity_handle" varchar(64) not null, "object_definition_handle" int null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );

    this.addSql(
      `create index "dvelop_entity_mapping_item_connection_handle_index" on "dvelop_entity_mapping_item" ("connection_handle");`,
    );
    this.addSql(
      `create index "dvelop_entity_mapping_item_entity_handle_index" on "dvelop_entity_mapping_item" ("entity_handle");`,
    );
    this.addSql(
      `create index "dvelop_entity_mapping_item_object_definition_handle_index" on "dvelop_entity_mapping_item" ("object_definition_handle");`,
    );

    this.addSql(
      `create table "dvelop_entity_mapping_search_category_item" ("handle" serial primary key, "mapping_handle" int not null, "object_definition_handle" int not null, "sort_order" int not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "dvelop_entity_mapping_search_category_item_mapping_handle_index" on "dvelop_entity_mapping_search_category_item" ("mapping_handle");`,
    );
    this.addSql(
      `create index "dvelop_entity_mapping_search_category_item_object_definition_handle_index" on "dvelop_entity_mapping_search_category_item" ("object_definition_handle");`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_mapping_handle_object_definition_handle_unique" unique ("mapping_handle", "object_definition_handle");`,
    );

    this.addSql(
      `create table "dvelop_entity_mapping_property_item" ("handle" serial primary key, "mapping_handle" int not null, "property_handle" int not null, "source_field" varchar(128) null, "static_value" varchar(256) null, "sort_order" int not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create index "dvelop_entity_mapping_property_item_mapping_handle_index" on "dvelop_entity_mapping_property_item" ("mapping_handle");`,
    );
    this.addSql(
      `create index "dvelop_entity_mapping_property_item_property_handle_index" on "dvelop_entity_mapping_property_item" ("property_handle");`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" add constraint "dvelop_entity_mapping_property_item_mapping_handle_property_handle_unique" unique ("mapping_handle", "property_handle");`,
    );

    this.addSql(
      `alter table "dvelop_connection_item" add constraint "dvelop_connection_item_repository_handle_foreign" foreign key ("repository_handle") references "dvelop_repository_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "dvelop_connection_item" add constraint "dvelop_connection_item_default_object_definition_handle_foreign" foreign key ("default_object_definition_handle") references "dvelop_object_definition_item" ("handle") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table "dvelop_repository_item" add constraint "dvelop_repository_item_connection_handle_foreign" foreign key ("connection_handle") references "dvelop_connection_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_object_definition_item" add constraint "dvelop_object_definition_item_connection_handle_foreign" foreign key ("connection_handle") references "dvelop_connection_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_property_item" add constraint "dvelop_property_item_connection_handle_foreign" foreign key ("connection_handle") references "dvelop_connection_item" ("handle") on update cascade;`,
    );

    this.addSql(
      `alter table "dvelop_entity_mapping_item" add constraint "dvelop_entity_mapping_item_connection_handle_foreign" foreign key ("connection_handle") references "dvelop_connection_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_item" add constraint "dvelop_entity_mapping_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_item" add constraint "dvelop_entity_mapping_item_object_definition_handle_foreign" foreign key ("object_definition_handle") references "dvelop_object_definition_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_mapping_handle_foreign" foreign key ("mapping_handle") references "dvelop_entity_mapping_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" add constraint "dvelop_entity_mapping_search_category_item_object_definition_handle_foreign" foreign key ("object_definition_handle") references "dvelop_object_definition_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" add constraint "dvelop_entity_mapping_property_item_mapping_handle_foreign" foreign key ("mapping_handle") references "dvelop_entity_mapping_item" ("handle") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" add constraint "dvelop_entity_mapping_property_item_property_handle_foreign" foreign key ("property_handle") references "dvelop_property_item" ("handle") on update cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "dvelop_connection_item" drop constraint "dvelop_connection_item_repository_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_connection_item" drop constraint "dvelop_connection_item_default_object_definition_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_repository_item" drop constraint "dvelop_repository_item_connection_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_object_definition_item" drop constraint "dvelop_object_definition_item_connection_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_property_item" drop constraint "dvelop_property_item_connection_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_item" drop constraint "dvelop_entity_mapping_item_connection_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_item" drop constraint "dvelop_entity_mapping_item_entity_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_item" drop constraint "dvelop_entity_mapping_item_object_definition_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_mapping_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_search_category_item" drop constraint "dvelop_entity_mapping_search_category_item_object_definition_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" drop constraint "dvelop_entity_mapping_property_item_mapping_handle_foreign";`,
    );
    this.addSql(
      `alter table "dvelop_entity_mapping_property_item" drop constraint "dvelop_entity_mapping_property_item_property_handle_foreign";`,
    );
    this.addSql(`drop table if exists "dvelop_entity_mapping_property_item";`);
    this.addSql(
      `drop table if exists "dvelop_entity_mapping_search_category_item";`,
    );
    this.addSql(`drop table if exists "dvelop_entity_mapping_item";`);
    this.addSql(`drop table if exists "dvelop_property_item";`);
    this.addSql(`drop table if exists "dvelop_object_definition_item";`);
    this.addSql(`drop table if exists "dvelop_repository_item";`);
    this.addSql(`drop table if exists "dvelop_connection_item";`);
  }
}
