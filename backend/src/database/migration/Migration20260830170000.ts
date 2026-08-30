import { Migration } from '@mikro-orm/migrations';

export class Migration20260830170000 extends Migration {
  override up(): void {
    this.addSql(`create table "system_telemetry_instance_item" (
      "handle" varchar(128) not null,
      "hostname" varchar(255) not null,
      "app_version" varchar(64) null,
      "process_started_at" timestamptz not null,
      "last_sample_at" timestamptz null,
      "collector_enabled" boolean not null default true,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "system_telemetry_instance_item_pkey" primary key ("handle")
    );`);
    this.addSql(`create index "system_telemetry_instance_last_sample_idx"
      on "system_telemetry_instance_item" ("last_sample_at");`);

    this.addSql(`create table "system_metric_bucket_item" (
      "handle" bigserial primary key,
      "instance_handle" varchar(128) not null,
      "bucket_start" timestamptz not null,
      "resolution" varchar(8) not null,
      "metric_key" varchar(96) not null,
      "dimension_key" varchar(255) not null default '',
      "sample_count" integer not null default 1,
      "minimum" double precision not null,
      "maximum" double precision not null,
      "sum" double precision not null,
      "last" double precision not null,
      "created_at" timestamptz not null default now(),
      constraint "system_metric_bucket_instance_fk" foreign key ("instance_handle")
        references "system_telemetry_instance_item" ("handle") on delete cascade
    );`);
    this.addSql(`create unique index "system_metric_bucket_unique"
      on "system_metric_bucket_item" ("instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key");`);
    this.addSql(`create index "system_metric_bucket_series_idx"
      on "system_metric_bucket_item" ("metric_key", "resolution", "bucket_start");`);

    this.addSql(`create table "http_metric_bucket_item" (
      "handle" bigserial primary key,
      "bucket_start" timestamptz not null,
      "resolution" varchar(8) not null default '1m',
      "attribution_key" varchar(64) not null,
      "person_handle" integer null,
      "api_token_handle" integer null,
      "auth_kind" varchar(16) not null,
      "route_group" varchar(32) not null,
      "request_count" integer not null default 0,
      "client_error_count" integer not null default 0,
      "server_error_count" integer not null default 0,
      "request_bytes" bigint not null default 0,
      "response_bytes" bigint not null default 0,
      "duration_sum_ms" double precision not null default 0,
      "duration_max_ms" double precision not null default 0,
      "duration_histogram" jsonb not null default '[0,0,0,0,0,0,0,0,0,0]'::jsonb,
      "impersonated_count" integer not null default 0,
      "created_at" timestamptz not null default now(),
      constraint "http_metric_bucket_person_fk" foreign key ("person_handle")
        references "person_item" ("handle") on delete set null,
      constraint "http_metric_bucket_token_fk" foreign key ("api_token_handle")
        references "person_api_token_item" ("handle") on delete set null
    );`);
    this.addSql(`create unique index "http_metric_bucket_unique"
      on "http_metric_bucket_item" ("bucket_start", "resolution", "attribution_key", "route_group", "auth_kind");`);
    this.addSql(`create index "http_metric_bucket_person_idx"
      on "http_metric_bucket_item" ("person_handle", "bucket_start");`);

    this.addSql(`create table "ai_usage_event_item" (
      "handle" bigserial primary key,
      "source_key" varchar(160) not null unique,
      "person_handle" integer null,
      "operation" varchar(32) not null,
      "execution_type" varchar(24) not null default 'interactive',
      "provider" varchar(64) null,
      "model" varchar(128) null,
      "status" varchar(24) not null,
      "duration_ms" integer null,
      "input_tokens" integer null,
      "output_tokens" integer null,
      "total_tokens" integer null,
      "usage_reported" boolean not null default false,
      "occurred_at" timestamptz not null,
      "created_at" timestamptz not null default now(),
      constraint "ai_usage_event_person_fk" foreign key ("person_handle")
        references "person_item" ("handle") on delete set null
    );`);
    this.addSql(`create index "ai_usage_event_person_time_idx"
      on "ai_usage_event_item" ("person_handle", "occurred_at");`);
    this.addSql(`create index "ai_usage_event_provider_time_idx"
      on "ai_usage_event_item" ("provider", "model", "occurred_at");`);

    this.addSql(`create table "authentication_event_item" (
      "handle" bigserial primary key,
      "person_handle" integer null,
      "event_type" varchar(32) not null,
      "provider" varchar(24) not null,
      "occurred_at" timestamptz not null default now(),
      constraint "authentication_event_person_fk" foreign key ("person_handle")
        references "person_item" ("handle") on delete set null
    );`);
    this.addSql(`create index "authentication_event_person_time_idx"
      on "authentication_event_item" ("person_handle", "occurred_at");`);

    this.addSql(`create table "system_alert_rule_item" (
      "handle" varchar(64) primary key,
      "title" varchar(128) not null,
      "metric_key" varchar(96) not null,
      "severity" varchar(16) not null default 'warning',
      "comparator" varchar(8) not null default 'gt',
      "threshold" double precision not null,
      "window_seconds" integer not null default 300,
      "minimum_count" integer not null default 1,
      "scope" varchar(16) not null default 'global',
      "is_active" boolean not null default true,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now()
    );`);

    this.addSql(`create table "system_alert_incident_item" (
      "handle" bigserial primary key,
      "rule_handle" varchar(64) not null,
      "fingerprint" varchar(320) not null,
      "dimension_key" varchar(255) not null default '',
      "state" varchar(16) not null default 'open',
      "severity" varchar(16) not null,
      "observed_value" double precision not null,
      "threshold" double precision not null,
      "healthy_evaluations" integer not null default 0,
      "notified_severity" varchar(16) null,
      "first_seen_at" timestamptz not null,
      "last_seen_at" timestamptz not null,
      "resolved_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      constraint "system_alert_incident_rule_fk" foreign key ("rule_handle")
        references "system_alert_rule_item" ("handle") on delete restrict
    );`);
    this.addSql(`create index "system_alert_incident_fingerprint_idx"
      on "system_alert_incident_item" ("fingerprint");`);
    this.addSql(`create index "system_alert_incident_state_time_idx"
      on "system_alert_incident_item" ("state", "last_seen_at");`);

    this.addSql(`alter table "session_store_item"
      add column "person_handle" integer null,
      add column "last_seen_at" timestamptz null;`);
    this.addSql(
      `create index "session_store_person_idx" on "session_store_item" ("person_handle");`,
    );
    this.addSql(
      `create index "session_store_last_seen_idx" on "session_store_item" ("last_seen_at");`,
    );
    this.addSql(`alter table "session_store_item"
      add constraint "session_store_person_fk" foreign key ("person_handle")
      references "person_item" ("handle") on delete set null;`);
  }

  override down(): void {
    this.addSql(
      `alter table "session_store_item" drop constraint if exists "session_store_person_fk";`,
    );
    this.addSql(`drop index if exists "session_store_last_seen_idx";`);
    this.addSql(`drop index if exists "session_store_person_idx";`);
    this.addSql(
      `alter table "session_store_item" drop column "last_seen_at", drop column "person_handle";`,
    );
    this.addSql(`drop table if exists "system_alert_incident_item" cascade;`);
    this.addSql(`drop table if exists "system_alert_rule_item" cascade;`);
    this.addSql(`drop table if exists "authentication_event_item" cascade;`);
    this.addSql(`drop table if exists "ai_usage_event_item" cascade;`);
    this.addSql(`drop table if exists "http_metric_bucket_item" cascade;`);
    this.addSql(`drop table if exists "system_metric_bucket_item" cascade;`);
    this.addSql(
      `drop table if exists "system_telemetry_instance_item" cascade;`,
    );
  }
}
