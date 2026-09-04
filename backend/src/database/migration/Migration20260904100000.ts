import { Migration } from '@mikro-orm/migrations';

export class Migration20260904100000 extends Migration {
  override up(): void {
    for (const table of [
      'inbox_subscription_item',
      'teams_subscription_item',
      'webhook_subscription_item',
    ]) {
      this.addSql(
        `alter table "${table}" alter column "is_active" set default false;`,
      );
    }
    this.addSql(
      `alter table "inbox_notification_item" add column "automation_deduplication_key" varchar(190) null;`,
    );
    this.addSql(
      `alter table "inbox_notification_item" add constraint "inbox_notification_item_automation_deduplication_key_unique" unique ("automation_deduplication_key");`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add column "automation_deduplication_key" varchar(190) null;`,
    );
    this.addSql(
      `alter table "teams_delivery_item" add constraint "teams_delivery_item_automation_deduplication_key_unique" unique ("automation_deduplication_key");`,
    );
    this.addSql(
      `alter table "webhook_delivery_item" add column "automation_deduplication_key" varchar(190) null;`,
    );
    this.addSql(
      `alter table "webhook_delivery_item" add constraint "webhook_delivery_item_automation_deduplication_key_unique" unique ("automation_deduplication_key");`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" add column "source_entity_handle" varchar(64) null, add column "reference_path" jsonb not null default '[]', add column "conditions" jsonb not null default '[]', add column "priority" int not null default 0;`,
    );
    this.addSql(
      `alter table "inbox_subscription_item" add constraint "inbox_subscription_item_source_entity_handle_foreign" foreign key ("source_entity_handle") references "entity_item" ("handle") on update cascade on delete set null;`,
    );
    for (const table of [
      'teams_subscription_item',
      'webhook_subscription_item',
    ]) {
      this.addSql(
        `alter table "${table}" add column "source_entity_handle" varchar(64) null, add column "reference_path" jsonb not null default '[]', add column "conditions" jsonb not null default '[]', add column "priority" int not null default 0;`,
      );
      this.addSql(
        `alter table "${table}" add constraint "${table}_source_entity_handle_foreign" foreign key ("source_entity_handle") references "entity_item" ("handle") on update cascade on delete set null;`,
      );
    }
    for (const table of [
      'inbox_subscription_item',
      'teams_subscription_item',
      'webhook_subscription_item',
    ]) {
      this.addSql(
        `update "${table}" set "source_entity_handle" = "entity_handle" where "source_entity_handle" is null;`,
      );
    }
    this.addSql(
      `create table "field_automation_item" ("handle" serial primary key, "description" varchar(128) not null, "source_entity_handle" varchar(64) not null, "target_entity_handle" varchar(64) not null, "operation_handle" varchar(64) not null default 'afterUpdate', "reference_path" jsonb not null default '[]', "conditions" jsonb not null default '[]', "assignments" jsonb not null default '[]', "priority" int not null default 0, "is_active" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "field_automation_item" add constraint "field_automation_item_source_entity_handle_foreign" foreign key ("source_entity_handle") references "entity_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "field_automation_item" add constraint "field_automation_item_target_entity_handle_foreign" foreign key ("target_entity_handle") references "entity_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "field_automation_item" add constraint "field_automation_item_operation_handle_foreign" foreign key ("operation_handle") references "webhook_subscription_type_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `create table "automation_event_item" ("handle" serial primary key, "event_id" varchar(36) not null, "source_entity_handle" varchar(64) not null, "source_handle" varchar(64) not null, "operation" varchar(32) not null, "actor_handle" int not null, "chain_id" varchar(36) not null, "chain_depth" int not null default 0, "old_snapshot" jsonb null, "new_snapshot" jsonb null, "context" jsonb null, "status" varchar(16) not null default 'pending', "attempt_count" int not null default 0, "error" text null, "next_attempt_at" timestamptz null, "processing_started_at" timestamptz null, "created_at" timestamptz not null, "completed_at" timestamptz null);`,
    );
    this.addSql(
      `alter table "automation_event_item" add constraint "automation_event_item_event_id_unique" unique ("event_id");`,
    );
    this.addSql(
      `alter table "automation_event_item" add constraint "automation_event_item_source_entity_handle_foreign" foreign key ("source_entity_handle") references "entity_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `alter table "automation_event_item" add constraint "automation_event_item_actor_handle_foreign" foreign key ("actor_handle") references "person_item" ("handle") on update cascade;`,
    );
    this.addSql(
      `create index "automation_event_item_pending_idx" on "automation_event_item" ("status", "handle");`,
    );
    this.addSql(
      `create table "automation_execution_item" ("handle" serial primary key, "deduplication_key" varchar(190) not null, "event_handle" int not null, "target_entity_handle" varchar(64) not null, "target_handle" varchar(64) not null, "action_type" varchar(16) not null, "rule_handle" varchar(32) not null, "status" varchar(16) not null, "message" text null, "created_at" timestamptz not null);`,
    );
    this.addSql(
      `alter table "automation_execution_item" add constraint "automation_execution_item_deduplication_key_unique" unique ("deduplication_key");`,
    );
    this.addSql(
      `alter table "automation_execution_item" add constraint "automation_execution_item_event_handle_foreign" foreign key ("event_handle") references "automation_event_item" ("handle") on delete cascade;`,
    );
    this.addSql(
      `alter table "automation_execution_item" add constraint "automation_execution_item_target_entity_handle_foreign" foreign key ("target_entity_handle") references "entity_item" ("handle") on update cascade;`,
    );
  }

  override down(): void {
    this.addSql('drop table if exists "automation_execution_item" cascade;');
    this.addSql('drop table if exists "automation_event_item" cascade;');
    this.addSql('drop table if exists "field_automation_item" cascade;');
    this.addSql(
      'alter table "inbox_notification_item" drop column if exists "automation_deduplication_key";',
    );
    this.addSql(
      'alter table "teams_delivery_item" drop column if exists "automation_deduplication_key";',
    );
    this.addSql(
      'alter table "webhook_delivery_item" drop column if exists "automation_deduplication_key";',
    );
    for (const table of [
      'inbox_subscription_item',
      'teams_subscription_item',
      'webhook_subscription_item',
    ]) {
      this.addSql(
        `alter table "${table}" alter column "is_active" set default true;`,
      );
    }
    this.addSql(
      'alter table "inbox_subscription_item" drop column if exists "source_entity_handle", drop column if exists "reference_path", drop column if exists "conditions", drop column if exists "priority";',
    );
    this.addSql(
      'alter table "teams_subscription_item" drop column if exists "source_entity_handle", drop column if exists "reference_path", drop column if exists "conditions", drop column if exists "priority";',
    );
    this.addSql(
      'alter table "webhook_subscription_item" drop column if exists "source_entity_handle", drop column if exists "reference_path", drop column if exists "conditions", drop column if exists "priority";',
    );
  }
}
