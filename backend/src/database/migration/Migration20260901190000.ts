import { Migration } from '@mikro-orm/migrations';

/**
 * Remove the short-lived telemetry history imported by the first
 * environment-aware monitoring migration.
 *
 * Imported environments are identified exclusively by the reserved handles
 * created in Migration20260901150000. Current host/configured environments
 * never use these handles and remain untouched.
 */
export class Migration20260901190000 extends Migration {
  override up(): void {
    for (const table of DIRECT_ENVIRONMENT_TABLES) {
      this.addSql(
        `delete from "${table}" where ${LEGACY_ENVIRONMENT_PREDICATE};`,
      );
    }

    // Metric buckets are removed by the instance foreign key's ON DELETE
    // CASCADE. Error occurrences were deleted above, so their optional
    // instance reference cannot retain a legacy instance.
    this.addSql(
      `delete from "system_telemetry_instance_item" where ${LEGACY_ENVIRONMENT_PREDICATE};`,
    );
    this.addSql(
      `delete from "system_telemetry_environment_item"
       where "handle" = 'legacy-imported' or "handle" like 'legacy:%';`,
    );
  }

  override down(): void {
    // This migration intentionally discards non-production trial telemetry.
    // Deleted observations cannot be reconstructed safely on rollback.
  }
}

const LEGACY_ENVIRONMENT_PREDICATE = `"environment_handle" = 'legacy-imported' or "environment_handle" like 'legacy:%'`;

// Ordering matters for the incident/group foreign keys. Tables containing
// references to incidents, groups, or instances are deleted before their
// parent rows.
const DIRECT_ENVIRONMENT_TABLES = [
  'system_remediation_execution_item',
  'system_error_occurrence_item',
  'system_error_group_item',
  'system_check_run_item',
  'system_alert_incident_item',
  'http_metric_bucket_item',
  'ai_usage_event_item',
  'authentication_event_item',
] as const;
