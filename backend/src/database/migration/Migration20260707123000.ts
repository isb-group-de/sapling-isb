import { Migration } from '@mikro-orm/migrations';

export class Migration20260707123000 extends Migration {
  override up(): void {
    this.addSql(
      `create table "internal_case_status_item" ("handle" varchar(64) not null, "description" varchar(64) not null, "color" varchar(16) not null, "icon" varchar(64) not null default 'mdi-clipboard-text-outline', "is_open" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "internal_case_status_item_pkey" primary key ("handle"));`,
    );
    this.addSql(
      `create table "internal_case_category_item" ("handle" varchar(64) not null, "title" varchar(128) not null, "icon" varchar(64) not null default 'mdi-shape-outline', "color" varchar(32) not null default '#5C6BC0', "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "internal_case_category_item_pkey" primary key ("handle"));`,
    );
    this.addSql(
      `create table "internal_case_item" ("handle" serial primary key, "number" varchar(32) null, "title" varchar(128) not null, "status_handle" varchar(64) not null default 'open', "category_handle" varchar(64) not null default 'internalRequest', "request_markdown" text null, "internal_information_markdown" text null, "customer_company_handle" int null, "customer_person_handle" int null, "responsible_company_handle" int null, "responsible_person_handle" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_status_handle_foreign" foreign key ("status_handle") references "internal_case_status_item" ("handle");`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_category_handle_foreign" foreign key ("category_handle") references "internal_case_category_item" ("handle");`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_customer_company_handle_foreign" foreign key ("customer_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_customer_person_handle_foreign" foreign key ("customer_person_handle") references "person_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_responsible_company_handle_foreign" foreign key ("responsible_company_handle") references "company_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "internal_case_item" add constraint "internal_case_item_responsible_person_handle_foreign" foreign key ("responsible_person_handle") references "person_item" ("handle") on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(`drop table if exists "internal_case_item" cascade;`);
    this.addSql(`drop table if exists "internal_case_category_item" cascade;`);
    this.addSql(`drop table if exists "internal_case_status_item" cascade;`);
  }
}
