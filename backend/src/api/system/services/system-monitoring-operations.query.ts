import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import { SystemAlertIncidentItem } from '../../../entity/SystemAlertIncidentItem';
import { SystemAlertRuleItem } from '../../../entity/SystemAlertRuleItem';
import type {
  MonitoringGroupQueryDto,
  MonitoringRangeQueryDto,
  UpdateSystemAlertRuleDto,
} from '../dto/monitoring-query.dto';
import type { HttpTelemetryService } from './http-telemetry.service';
import { executeRows } from './sql-query.utils';
import type { SystemTelemetryCollectorService } from './system-telemetry-collector.service';
import type { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';
import {
  aiGroupSql,
  resolveRange,
  serializeRange,
} from './system-monitoring-query.utils';

export class SystemMonitoringOperationsQuery {
  constructor(
    private readonly em: EntityManager,
    private readonly collector: SystemTelemetryCollectorService,
    private readonly httpTelemetry: HttpTelemetryService,
    private readonly environment: SystemTelemetryEnvironmentService,
  ) {}

  async getAiUsage(query: MonitoringGroupQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const groupExpression = aiGroupSql(query.groupBy);
    const rows = await executeRows(
      this.em.fork(),
      `select ${groupExpression} as "group", count(*)::int as "callCount",
          count(*) filter (where "status" in ('completed', 'failed'))::int as "terminalCount",
          count(*) filter (where "status" = 'failed')::int as "errorCount",
          count(*) filter (where "status" in ('interrupted', 'cancelled'))::int as "interruptedCount",
         count(*) filter (where "usage_reported")::int as "reportedCount",
         coalesce(sum("input_tokens"), 0)::bigint as "inputTokens",
         coalesce(sum("output_tokens"), 0)::bigint as "outputTokens",
         coalesce(sum("total_tokens"), 0)::bigint as "totalTokens",
         coalesce(avg("duration_ms"), 0)::float8 as "averageDurationMs"
       from "ai_usage_event_item" where "occurred_at" between ? and ? and "environment_handle" = ?
       group by ${groupExpression} order by "totalTokens" desc`,
      [range.from, range.to, environmentId],
    );
    return { range: serializeRange(range), groups: rows };
  }

  async getIncidents(query: MonitoringRangeQueryDto = {}) {
    const environmentId = query.environment || this.environment.currentId;
    const incidents = await this.em.fork().find(
      SystemAlertIncidentItem,
      { environment: { handle: environmentId } },
      {
        populate: ['rule', 'environment'],
        orderBy: { lastSeenAt: 'DESC' },
        limit: 250,
      },
    );
    const ignoredFilesystems = new Set(
      this.collector.getStatus().ignoredFilesystems ?? [],
    );
    return incidents.filter(
      (incident) =>
        incident.rule.metricKey !== 'filesystem.usedPercent' ||
        !ignoredFilesystems.has(incident.dimensionKey),
    );
  }

  async getIncident(handle: number, query: MonitoringRangeQueryDto = {}) {
    const environmentId = query.environment || this.environment.currentId;
    const incident = await this.em
      .fork()
      .findOne(
        SystemAlertIncidentItem,
        { handle, environment: { handle: environmentId } },
        { populate: ['rule', 'environment'] },
      );
    if (!incident) throw new NotFoundException('global.notFound');
    return incident;
  }

  async getAlertRules() {
    return this.em
      .fork()
      .find(SystemAlertRuleItem, {}, { orderBy: { handle: 'ASC' } });
  }

  async updateAlertRule(handle: string, dto: UpdateSystemAlertRuleDto) {
    const em = this.em.fork();
    const rule = await em.findOne(SystemAlertRuleItem, { handle });
    if (!rule) throw new NotFoundException('global.notFound');
    em.assign(rule, dto);
    await em.flush();
    return rule;
  }

  async getEnvironments() {
    const rows = await executeRows(
      this.em.fork(),
      `select environment."handle", environment."name", environment."kind",
         environment."is_archived" as "isArchived", environment."first_seen_at" as "firstSeenAt",
         environment."last_seen_at" as "lastSeenAt",
         count(instance."handle") filter (where instance."status" = 'active')::int as "activeInstances"
       from "system_telemetry_environment_item" environment
       left join "system_telemetry_instance_item" instance on instance."environment_handle" = environment."handle"
       group by environment."handle" order by (environment."handle" = ?) desc, environment."last_seen_at" desc`,
      [this.environment.currentId],
    );
    return { current: this.environment.currentId, environments: rows };
  }

  async getServices(query: MonitoringRangeQueryDto) {
    const environmentId = query.environment || this.environment.currentId;
    const rows = await executeRows(
      this.em.fork(),
      `select distinct on ("category") "category" as "service", "status", "duration_ms" as "durationMs",
         "summary", "completed_at" as "lastCheckedAt"
       from "system_check_run_item" where "environment_handle" = ?
       order by "category", "completed_at" desc`,
      [environmentId],
    );
    return { environment: environmentId, services: rows };
  }

  async getErrors(query: MonitoringRangeQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const rows = await executeRows(
      this.em.fork(),
      `select error_group."handle", error_group."fingerprint", error_group."source",
         error_group."operation", error_group."status",
         error_group."occurrence_count" as "occurrenceCount",
         error_group."latest_release" as "latestRelease",
         error_group."first_seen_at" as "firstSeenAt",
         error_group."last_seen_at" as "lastSeenAt",
         latest."error_class" as "latestErrorClass", latest."message" as "latestMessage",
         latest."request_id" as "latestRequestId", latest."correlation_id" as "latestCorrelationId"
       from "system_error_group_item" error_group
       left join lateral (
         select occurrence."error_class", occurrence."message", occurrence."request_id", occurrence."correlation_id"
         from "system_error_occurrence_item" occurrence
         where occurrence."group_handle" = error_group."handle"
         order by occurrence."occurred_at" desc limit 1
       ) latest on true
       where error_group."environment_handle" = ? and error_group."last_seen_at" between ? and ?
       order by error_group."last_seen_at" desc limit 250`,
      [environmentId, range.from, range.to],
    );
    return {
      environment: environmentId,
      range: serializeRange(range),
      groups: rows,
    };
  }

  async getChecks(query: MonitoringRangeQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const rows = await executeRows(
      this.em.fork(),
      `select "handle", "check_key" as "checkKey", "category", "status",
         "duration_ms" as "durationMs", "summary", "started_at" as "startedAt",
         "completed_at" as "completedAt" from "system_check_run_item"
       where "environment_handle" = ? and "started_at" between ? and ?
       order by "started_at" desc limit 250`,
      [environmentId, range.from, range.to],
    );
    return {
      environment: environmentId,
      range: serializeRange(range),
      checks: rows,
    };
  }

  async getRemediations(query: MonitoringRangeQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const rows = await executeRows(
      this.em.fork(),
      `select "handle", "incident_handle" as "incidentHandle", "action_key" as "actionKey",
         "mode", "state", "attempt", "evidence", "started_at" as "startedAt",
         "completed_at" as "completedAt" from "system_remediation_execution_item"
       where "environment_handle" = ? and "started_at" between ? and ?
       order by "started_at" desc limit 250`,
      [environmentId, range.from, range.to],
    );
    return {
      environment: environmentId,
      range: serializeRange(range),
      executions: rows,
    };
  }

  async getCollectorStatus(query: MonitoringRangeQueryDto = {}) {
    const environmentId = query.environment || this.environment.currentId;
    const em = this.em.fork();
    const [instances, tableSizes] = await Promise.all([
      executeRows(
        em,
        `select "handle" as "instanceId", "process_started_at" as "processStartedAt",
           "last_sample_at" as "lastSampleAt",
           greatest(0, extract(epoch from now() - "last_sample_at"))::float8 as "gapSeconds",
           "collector_enabled" as "enabled", "hostname", "process_slot" as "processSlot",
           "boot_id" as "bootId", "status", "lifecycle_reason" as "lifecycleReason"
         from "system_telemetry_instance_item" where "environment_handle" = ?
         order by "last_sample_at" desc nulls last`,
        [environmentId],
      ),
      executeRows(
        em,
        `select relation as "table", pg_total_relation_size(relation)::bigint as "bytes"
         from unnest(array[
           'system_metric_bucket_item'::regclass, 'http_metric_bucket_item'::regclass,
           'ai_usage_event_item'::regclass, 'authentication_event_item'::regclass,
           'system_alert_incident_item'::regclass
         ]) relation`,
      ),
    ]);
    return {
      collector:
        environmentId === this.environment.currentId
          ? this.collector.getStatus()
          : null,
      environment: environmentId,
      http: this.httpTelemetry.getStatus(),
      instances,
      tableSizes,
      enabledSources: [
        'host',
        'process',
        'eventLoop',
        'network',
        'filesystem',
        'database',
        'documentStorage',
        'http',
        'authentication',
        'ai',
      ],
    };
  }
}
