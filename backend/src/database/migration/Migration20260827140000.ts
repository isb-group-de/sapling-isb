import { Migration } from '@mikro-orm/migrations';

export class Migration20260827140000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "sla_policy_item" add column "work_week_handle" int null, add column "holiday_group_handle" int null, add column "time_zone" varchar(64) null;`,
    );
    this.addSql(
      `create index "sla_policy_item_work_week_handle_index" on "sla_policy_item" ("work_week_handle");`,
    );
    this.addSql(
      `create index "sla_policy_item_holiday_group_handle_index" on "sla_policy_item" ("holiday_group_handle");`,
    );
    this.addSql(
      `alter table "sla_policy_item" add constraint "sla_policy_item_work_week_handle_foreign" foreign key ("work_week_handle") references "work_hour_week_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "sla_policy_item" add constraint "sla_policy_item_holiday_group_handle_foreign" foreign key ("holiday_group_handle") references "holiday_group_item" ("handle") on delete set null;`,
    );
    this.addSql(
      `alter table "email_subscription_item" add column "allow_repeated_sending" boolean not null default true;`,
    );
    this.addSql(
      `alter table "email_delivery_item" add column "subscription_handle" int null, add column "automation_deduplication_key" varchar(160) null;`,
    );
    this.addSql(
      `create index "email_delivery_item_subscription_handle_index" on "email_delivery_item" ("subscription_handle");`,
    );
    this.addSql(
      `create unique index "email_delivery_item_automation_deduplication_key_unique" on "email_delivery_item" ("automation_deduplication_key");`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_subscription_handle_foreign" foreign key ("subscription_handle") references "email_subscription_item" ("handle") on delete set null;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "sla_policy_item" drop constraint if exists "sla_policy_item_work_week_handle_foreign";`,
    );
    this.addSql(
      `alter table "sla_policy_item" drop constraint if exists "sla_policy_item_holiday_group_handle_foreign";`,
    );
    this.addSql(
      `alter table "sla_policy_item" drop column if exists "work_week_handle", drop column if exists "holiday_group_handle", drop column if exists "time_zone";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop constraint if exists "email_delivery_item_subscription_handle_foreign";`,
    );
    this.addSql(
      `drop index if exists "email_delivery_item_subscription_handle_index";`,
    );
    this.addSql(
      `drop index if exists "email_delivery_item_automation_deduplication_key_unique";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop column if exists "subscription_handle", drop column if exists "automation_deduplication_key";`,
    );
    this.addSql(
      `alter table "email_subscription_item" drop column if exists "allow_repeated_sending";`,
    );
  }
}
