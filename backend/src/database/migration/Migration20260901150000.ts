import { Migration } from '@mikro-orm/migrations';

/** Add environment-aware telemetry, error correlation, checks, and remediation audit data. */
export class Migration20260901150000 extends Migration {
  override up(): void {
    this.addSql(`create table "system_telemetry_environment_item" (
      "handle" varchar(96) not null, "name" varchar(128) not null,
      "kind" varchar(24) not null, "is_archived" boolean not null default false,
      "first_seen_at" timestamptz not null, "last_seen_at" timestamptz not null,
      constraint "system_telemetry_environment_item_pkey" primary key ("handle")
    );`);
    this.addSql(
      `create index "system_telemetry_environment_item_last_seen_at_index" on "system_telemetry_environment_item" ("last_seen_at");`,
    );
    this
      .addSql(`insert into "system_telemetry_environment_item" ("handle", "name", "kind", "first_seen_at", "last_seen_at")
      values ('legacy-imported', 'Legacy import', 'imported', now(), now());`);
    this
      .addSql(`insert into "system_telemetry_environment_item" ("handle", "name", "kind", "first_seen_at", "last_seen_at")
      select distinct left('legacy:' || regexp_replace(lower("hostname"), '[^a-z0-9._:-]+', '-', 'g'), 96),
        'Legacy ' || "hostname", 'imported', min("created_at"), max(coalesce("last_sample_at", "updated_at"))
      from "system_telemetry_instance_item" group by "hostname" on conflict ("handle") do nothing;`);

    this
      .addSql(`alter table "system_telemetry_instance_item" add column "environment_handle" varchar(96) null,
      add column "process_slot" varchar(96) null, add column "boot_id" varchar(64) null,
      add column "status" varchar(16) not null default 'retired',
      add column "stopped_at" timestamptz null, add column "retired_at" timestamptz null,
      add column "lifecycle_reason" varchar(48) null;`);
    this.addSql(`update "system_telemetry_instance_item" set
      "environment_handle" = left('legacy:' || regexp_replace(lower("hostname"), '[^a-z0-9._:-]+', '-', 'g'), 96),
      "process_slot" = "handle", "boot_id" = md5("handle"), "status" = 'retired',
      "retired_at" = coalesce("last_sample_at", "updated_at"), "lifecycle_reason" = 'legacyImported';`);
    this
      .addSql(`alter table "system_telemetry_instance_item" alter column "environment_handle" set not null,
      alter column "process_slot" set not null, alter column "boot_id" set not null;`);
    this
      .addSql(`alter table "system_telemetry_instance_item" add constraint "system_telemetry_instance_environment_foreign"
      foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`);
    this.addSql(
      `create unique index "system_telemetry_instance_item_boot_id_unique" on "system_telemetry_instance_item" ("boot_id");`,
    );
    this.addSql(
      `create index "system_telemetry_instance_environment_slot_status_idx" on "system_telemetry_instance_item" ("environment_handle", "process_slot", "status");`,
    );
    this.addSql(
      `create index "system_telemetry_instance_item_status_index" on "system_telemetry_instance_item" ("status");`,
    );

    for (const table of [
      'http_metric_bucket_item',
      'ai_usage_event_item',
      'authentication_event_item',
      'system_alert_incident_item',
    ]) {
      this.addSql(
        `alter table "${table}" add column "environment_handle" varchar(96) null;`,
      );
      this.addSql(
        `update "${table}" set "environment_handle" = 'legacy-imported';`,
      );
      this.addSql(
        `alter table "${table}" alter column "environment_handle" set not null;`,
      );
      this.addSql(
        `alter table "${table}" add constraint "${table}_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade;`,
      );
    }
    this.addSql(
      `create index "ai_usage_event_environment_time_idx" on "ai_usage_event_item" ("environment_handle", "occurred_at");`,
    );
    this.addSql(
      `create index "authentication_event_environment_time_idx" on "authentication_event_item" ("environment_handle", "occurred_at");`,
    );
    this.addSql(
      `create index "system_alert_incident_environment_state_time_idx" on "system_alert_incident_item" ("environment_handle", "state", "last_seen_at");`,
    );

    this.addSql(`drop index if exists "http_metric_bucket_unique";`);
    this
      .addSql(`alter table "http_metric_bucket_item" add column "operation" varchar(192) not null default '',
      add column "aborted_count" int not null default 0, add column "timeout_count" int not null default 0;`);
    this.addSql(
      `create unique index "http_metric_bucket_unique" on "http_metric_bucket_item" ("environment_handle", "bucket_start", "resolution", "attribution_key", "route_group", "operation", "auth_kind");`,
    );

    this
      .addSql(`alter table "system_alert_rule_item" add column "evaluation_type" varchar(24) not null default 'threshold',
      add column "evaluation_config" jsonb null, add column "shadow_mode" boolean not null default false,
      add column "remediation_mode" varchar(16) not null default 'none', add column "remediation_action_key" varchar(96) null;`);
    this
      .addSql(`alter table "system_alert_incident_item" add column "incident_type" varchar(24) not null default 'threshold',
      add column "correlation_key" varchar(320) null, add column "diagnosis" jsonb null,
      add column "resolved_reason" varchar(48) null;`);
    this.addSql(
      `create index "system_alert_incident_item_correlation_key_index" on "system_alert_incident_item" ("correlation_key");`,
    );

    this.addSql(`create table "system_error_group_item" (
      "handle" serial primary key, "environment_handle" varchar(96) not null,
      "fingerprint" varchar(64) not null, "source" varchar(24) not null,
      "operation" varchar(160) not null, "status" varchar(16) not null default 'open',
      "occurrence_count" int not null default 1, "latest_release" varchar(128) null,
      "first_seen_at" timestamptz not null, "last_seen_at" timestamptz not null,
      constraint "system_error_group_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade
    );`);
    this.addSql(
      `create unique index "system_error_group_environment_fingerprint_unique" on "system_error_group_item" ("environment_handle", "fingerprint");`,
    );
    this.addSql(
      `create index "system_error_group_status_last_seen_idx" on "system_error_group_item" ("status", "last_seen_at");`,
    );
    this.addSql(
      `create index "system_error_group_item_last_seen_at_index" on "system_error_group_item" ("last_seen_at");`,
    );

    this.addSql(`create table "system_error_occurrence_item" (
      "handle" serial primary key, "group_handle" int not null, "environment_handle" varchar(96) not null,
      "instance_handle" varchar(128) null, "operation" varchar(160) not null, "source" varchar(24) not null,
      "error_class" varchar(128) not null, "error_code" varchar(64) null, "message" varchar(500) not null,
      "stack" text null, "request_id" varchar(64) null, "correlation_id" varchar(64) null,
      "release" varchar(128) null, "occurred_at" timestamptz not null,
      constraint "system_error_occurrence_group_foreign" foreign key ("group_handle") references "system_error_group_item" ("handle") on delete cascade,
      constraint "system_error_occurrence_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade,
      constraint "system_error_occurrence_instance_foreign" foreign key ("instance_handle") references "system_telemetry_instance_item" ("handle") on delete set null
    );`);
    this.addSql(
      `create index "system_error_occurrence_group_time_idx" on "system_error_occurrence_item" ("group_handle", "occurred_at");`,
    );
    this.addSql(
      `create index "system_error_occurrence_environment_time_idx" on "system_error_occurrence_item" ("environment_handle", "occurred_at");`,
    );
    this.addSql(
      `create index "system_error_occurrence_item_request_id_index" on "system_error_occurrence_item" ("request_id");`,
    );
    this.addSql(
      `create index "system_error_occurrence_item_correlation_id_index" on "system_error_occurrence_item" ("correlation_id");`,
    );
    this.addSql(
      `create index "system_error_occurrence_item_occurred_at_index" on "system_error_occurrence_item" ("occurred_at");`,
    );

    this.addSql(`create table "system_check_run_item" (
      "handle" serial primary key, "environment_handle" varchar(96) not null,
      "check_key" varchar(96) not null, "category" varchar(32) not null, "status" varchar(16) not null,
      "duration_ms" int not null, "summary" varchar(500) null, "steps" jsonb null,
      "started_at" timestamptz not null, "completed_at" timestamptz not null,
      constraint "system_check_run_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade
    );`);
    this.addSql(
      `create index "system_check_run_environment_key_time_idx" on "system_check_run_item" ("environment_handle", "check_key", "started_at");`,
    );
    this.addSql(
      `create index "system_check_run_item_started_at_index" on "system_check_run_item" ("started_at");`,
    );

    this.addSql(`create table "system_remediation_execution_item" (
      "handle" serial primary key, "environment_handle" varchar(96) not null, "incident_handle" int null,
      "action_key" varchar(96) not null, "mode" varchar(16) not null, "state" varchar(24) not null,
      "attempt" int not null default 1, "idempotency_key" varchar(128) not null,
      "approved_by_handle" int null, "evidence" jsonb null, "started_at" timestamptz not null,
      "completed_at" timestamptz null,
      constraint "system_remediation_environment_foreign" foreign key ("environment_handle") references "system_telemetry_environment_item" ("handle") on update cascade,
      constraint "system_remediation_incident_foreign" foreign key ("incident_handle") references "system_alert_incident_item" ("handle") on delete set null,
      constraint "system_remediation_approved_by_foreign" foreign key ("approved_by_handle") references "person_item" ("handle") on delete set null
    );`);
    this.addSql(
      `create unique index "system_remediation_execution_item_idempotency_key_unique" on "system_remediation_execution_item" ("idempotency_key");`,
    );
    this.addSql(
      `create index "system_remediation_environment_time_idx" on "system_remediation_execution_item" ("environment_handle", "started_at");`,
    );
    this.addSql(
      `create index "system_remediation_execution_item_started_at_index" on "system_remediation_execution_item" ("started_at");`,
    );

    this.addSql(`create table "system_canary_record_item" (
      "handle" serial primary key, "marker" varchar(96) not null, "created_at" timestamptz not null
    );`);
    this.addSql(
      `create unique index "system_canary_record_item_marker_unique" on "system_canary_record_item" ("marker");`,
    );
  }

  override down(): void {
    this.addSql(`drop table if exists "system_canary_record_item" cascade;`);
    this.addSql(
      `drop table if exists "system_remediation_execution_item" cascade;`,
    );
    this.addSql(`drop table if exists "system_check_run_item" cascade;`);
    this.addSql(`drop table if exists "system_error_occurrence_item" cascade;`);
    this.addSql(`drop table if exists "system_error_group_item" cascade;`);
    this.addSql(
      `alter table "system_alert_incident_item" drop column if exists "incident_type", drop column if exists "correlation_key", drop column if exists "diagnosis", drop column if exists "resolved_reason", drop column if exists "environment_handle";`,
    );
    this.addSql(
      `alter table "system_alert_rule_item" drop column if exists "evaluation_type", drop column if exists "evaluation_config", drop column if exists "shadow_mode", drop column if exists "remediation_mode", drop column if exists "remediation_action_key";`,
    );
    this.addSql(`drop index if exists "http_metric_bucket_unique";`);
    this.addSql(
      `alter table "http_metric_bucket_item" drop column if exists "operation", drop column if exists "aborted_count", drop column if exists "timeout_count", drop column if exists "environment_handle";`,
    );
    this.addSql(
      `create unique index "http_metric_bucket_unique" on "http_metric_bucket_item" ("bucket_start", "resolution", "attribution_key", "route_group", "auth_kind");`,
    );
    this.addSql(
      `alter table "ai_usage_event_item" drop column if exists "environment_handle";`,
    );
    this.addSql(
      `alter table "authentication_event_item" drop column if exists "environment_handle";`,
    );
    this.addSql(
      `alter table "system_telemetry_instance_item" drop column if exists "environment_handle", drop column if exists "process_slot", drop column if exists "boot_id", drop column if exists "status", drop column if exists "stopped_at", drop column if exists "retired_at", drop column if exists "lifecycle_reason";`,
    );
    this.addSql(
      `drop table if exists "system_telemetry_environment_item" cascade;`,
    );
  }
}
