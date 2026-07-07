import { Migration } from '@mikro-orm/migrations';

export class Migration20260707120000 extends Migration {
  override up(): void {
    this.addSql(
      `create table "email_subscription_item" ("handle" serial primary key, "description" varchar(128) not null, "recipient_field" varchar(128) not null, "sender_person_handle" int not null, "is_active" boolean not null default true, "entity_handle" varchar(64) not null, "type_handle" varchar(64) not null default 'afterInsert', "template_handle" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `create table "email_subscription_condition_item" ("handle" serial primary key, "subscription_handle" int not null, "observed_field" varchar(128) not null, "old_value" varchar(256) null, "new_value" varchar(256) null, "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_sender_person_handle_foreign" foreign key ("sender_person_handle") references "person_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_entity_handle_foreign" foreign key ("entity_handle") references "entity_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_type_handle_foreign" foreign key ("type_handle") references "webhook_subscription_type_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_item" add constraint "email_subscription_item_template_handle_foreign" foreign key ("template_handle") references "email_template_item" ("handle");`,
    );
    this.addSql(
      `alter table "email_subscription_condition_item" add constraint "email_subscription_condition_item_subscription_handle_foreign" foreign key ("subscription_handle") references "email_subscription_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `create index "email_subscription_condition_item_subscription_handle_index" on "email_subscription_condition_item" ("subscription_handle");`,
    );
  }

  override down(): void {
    this.addSql(
      `drop table if exists "email_subscription_condition_item" cascade;`,
    );
    this.addSql(`drop table if exists "email_subscription_item" cascade;`);
  }
}
