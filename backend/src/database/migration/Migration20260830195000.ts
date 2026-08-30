import { Migration } from '@mikro-orm/migrations';

/**
 * Align telemetry surrogate keys with their numeric MikroORM properties.
 *
 * PostgreSQL exposes bigint/bigserial values as strings. The initial monitoring
 * migration used bigserial while the Sapling entities consistently model
 * generated handles as JavaScript numbers, which caused a validation failure
 * after an inserted incident was flushed a second time.
 */
export class Migration20260830195000 extends Migration {
  override up(): void {
    for (const table of NUMERIC_HANDLE_TABLES) {
      this.addSql(
        `alter table "${table}" alter column "handle" type integer using "handle"::integer;`,
      );
      this.addSql(`alter sequence if exists "${table}_handle_seq" as integer;`);
    }
  }

  override down(): void {
    for (const table of [...NUMERIC_HANDLE_TABLES].reverse()) {
      this.addSql(`alter sequence if exists "${table}_handle_seq" as bigint;`);
      this.addSql(
        `alter table "${table}" alter column "handle" type bigint using "handle"::bigint;`,
      );
    }
  }
}

const NUMERIC_HANDLE_TABLES = [
  'system_metric_bucket_item',
  'http_metric_bucket_item',
  'ai_usage_event_item',
  'authentication_event_item',
  'system_alert_incident_item',
] as const;
