import { Migration } from '@mikro-orm/migrations';

export class Migration20260729120000 extends Migration {
  override up(): void {
    this.addSql(
      `create table "event_category_item" (
        "handle" varchar(64) not null,
        "title" varchar(128) not null,
        "icon" varchar(64) not null default 'mdi-shape-outline',
        "color" varchar(32) not null default '#5C6BC0',
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        primary key ("handle")
      );`,
    );
    this.addSql(
      `insert into "event_category_item" ("handle", "title", "icon", "color", "created_at", "updated_at")
       values ('internal', 'Intern', 'mdi-account-group', '#4CAF50', now(), now());`,
    );
    this.addSql(
      `alter table "event_item" add column "category_handle" varchar(64) not null default 'internal';`,
    );
    this.addSql(
      `alter table "event_item" alter column "type_handle" set default 'online';`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item"
       add column "default_event_type_handle" varchar(64) not null default 'online',
       add column "default_event_category_handle" varchar(64) not null default 'internal',
       add column "classification_mappings" jsonb not null default '[]'::jsonb;`,
    );
    this.addSql(
      `create index "calendar_sync_subscription_item_default_event_type_handle_index" on "calendar_sync_subscription_item" ("default_event_type_handle");`,
    );
    this.addSql(
      `create index "calendar_sync_subscription_item_default_event_category_handle_index" on "calendar_sync_subscription_item" ("default_event_category_handle");`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_default_event_type_handle_foreign" foreign key ("default_event_type_handle") references "event_type_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" add constraint "calendar_sync_subscription_item_default_event_category_handle_foreign" foreign key ("default_event_category_handle") references "event_category_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `create index "event_item_category_handle_index" on "event_item" ("category_handle");`,
    );
    this.addSql(
      `alter table "event_item" add constraint "event_item_category_handle_foreign" foreign key ("category_handle") references "event_category_item" ("handle") on update cascade;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint if exists "calendar_sync_subscription_item_default_event_category_handle_foreign";`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item" drop constraint if exists "calendar_sync_subscription_item_default_event_type_handle_foreign";`,
    );
    this.addSql(
      `drop index if exists "calendar_sync_subscription_item_default_event_category_handle_index";`,
    );
    this.addSql(
      `drop index if exists "calendar_sync_subscription_item_default_event_type_handle_index";`,
    );
    this.addSql(
      `alter table "calendar_sync_subscription_item"
       drop column if exists "classification_mappings",
       drop column if exists "default_event_category_handle",
       drop column if exists "default_event_type_handle";`,
    );
    this.addSql(
      `alter table "event_item" drop constraint if exists "event_item_category_handle_foreign";`,
    );
    this.addSql(`drop index if exists "event_item_category_handle_index";`);
    this.addSql(
      `alter table "event_item" drop column if exists "category_handle";`,
    );
    this.addSql(
      `alter table "event_item" alter column "type_handle" drop default;`,
    );
    this.addSql(`drop table if exists "event_category_item" cascade;`);
  }
}
