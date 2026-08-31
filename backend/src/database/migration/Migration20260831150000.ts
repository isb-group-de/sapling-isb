import { Migration } from '@mikro-orm/migrations';

/** Add access paths used by monitoring queries, rollups, and retention purges. */
export class Migration20260831150000 extends Migration {
  override up(): void {
    this
      .addSql(`create index if not exists "system_metric_bucket_resolution_time_idx"
      on "system_metric_bucket_item" ("resolution", "bucket_start");`);
    this
      .addSql(`create index if not exists "http_metric_bucket_resolution_time_idx"
      on "http_metric_bucket_item" ("resolution", "bucket_start");`);
    this
      .addSql(`create index if not exists "http_metric_bucket_person_resolution_time_idx"
      on "http_metric_bucket_item" ("person_handle", "resolution", "bucket_start");`);
    this.addSql(`create index if not exists "ai_usage_event_occurred_at_idx"
      on "ai_usage_event_item" ("occurred_at");`);
    this.addSql(`create index if not exists "authentication_event_type_time_idx"
      on "authentication_event_item" ("event_type", "occurred_at");`);
    this
      .addSql(`create index if not exists "system_alert_incident_state_resolved_idx"
      on "system_alert_incident_item" ("state", "resolved_at");`);
  }

  override down(): void {
    this.addSql(
      `drop index if exists "system_alert_incident_state_resolved_idx";`,
    );
    this.addSql(`drop index if exists "authentication_event_type_time_idx";`);
    this.addSql(`drop index if exists "ai_usage_event_occurred_at_idx";`);
    this.addSql(
      `drop index if exists "http_metric_bucket_person_resolution_time_idx";`,
    );
    this.addSql(
      `drop index if exists "http_metric_bucket_resolution_time_idx";`,
    );
    this.addSql(
      `drop index if exists "system_metric_bucket_resolution_time_idx";`,
    );
  }
}
