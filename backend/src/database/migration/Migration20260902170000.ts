import { Migration } from '@mikro-orm/migrations';

export class Migration20260902170000 extends Migration {
  override up(): void {
    this.addSql(`drop index if exists "http_metric_bucket_unique";`);
    this.addSql(`alter table "http_metric_bucket_item"
      add column "request_kind" varchar(16) not null default 'standard',
      add column "resource_key" varchar(64) not null default '';`);
    this.addSql(`update "http_metric_bucket_item"
      set "request_kind" = 'stream',
        "client_error_count" = greatest(0, "client_error_count" - "aborted_count")
      where "operation" in (
        'GET /api/current/openTaskCountEvents',
        'POST /api/ai/chat/stream'
      );`);
    this.addSql(`create unique index "http_metric_bucket_unique"
      on "http_metric_bucket_item" (
        "environment_handle", "bucket_start", "resolution", "attribution_key",
        "route_group", "operation", "request_kind", "resource_key", "auth_kind"
      );`);
  }

  override down(): void {
    this.addSql(`drop index if exists "http_metric_bucket_unique";`);
    this.addSql(`alter table "http_metric_bucket_item"
      drop column "request_kind", drop column "resource_key";`);
    this.addSql(`create unique index "http_metric_bucket_unique"
      on "http_metric_bucket_item" (
        "environment_handle", "bucket_start", "resolution", "attribution_key",
        "route_group", "operation", "auth_kind"
      );`);
  }
}
