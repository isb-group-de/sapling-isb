import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SystemAlertIncidentItem } from '../../../entity/SystemAlertIncidentItem';
import { SystemAlertRuleItem } from '../../../entity/SystemAlertRuleItem';
import type {
  MonitoringGroupQueryDto,
  MonitoringRangeQueryDto,
  MonitoringSeriesQueryDto,
  MonitoringUsersQueryDto,
  UpdateSystemAlertRuleDto,
} from '../dto/monitoring-query.dto';
import { HttpTelemetryService } from './http-telemetry.service';
import { executeRows } from './sql-query.utils';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';
import { SystemTelemetryCollectorService } from './system-telemetry-collector.service';

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

type Range = { from: Date; to: Date };

@Injectable()
export class SystemMonitoringQueryService {
  constructor(
    private readonly em: EntityManager,
    private readonly collector: SystemTelemetryCollectorService,
    private readonly httpTelemetry: HttpTelemetryService,
    private readonly environment: SystemTelemetryEnvironmentService,
  ) {}

  async getSummary(query: MonitoringRangeQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const em = this.em.fork();
    const durationMs = range.to.getTime() - range.from.getTime();
    const previousRange = {
      from: new Date(range.from.getTime() - durationMs),
      to: range.from,
    };
    const [
      metricRows,
      httpRows,
      userRows,
      aiRows,
      incidentRows,
      previousHttpRows,
      previousAiRows,
    ] = await runWithConcurrency(
      [
        () =>
          executeRows(
            em,
            `select distinct on ("metric_key") "metric_key" as "metricKey",
             "last" as "value", "bucket_start" as "capturedAt"
           from "system_metric_bucket_item" metric
           join "system_telemetry_instance_item" instance on instance."handle" = metric."instance_handle"
           where metric."bucket_start" between ? and ? and instance."environment_handle" = ?
           order by "metric_key", "bucket_start" desc`,
            [range.from, range.to, environmentId],
          ),
        () =>
          executeRows(
            em,
            `select coalesce(sum("request_count"), 0)::int as "requestCount",
             coalesce(sum("client_error_count"), 0)::int as "clientErrorCount",
             coalesce(sum("server_error_count"), 0)::int as "serverErrorCount",
             coalesce(sum("aborted_count"), 0)::int as "abortedCount",
             coalesce(sum("timeout_count"), 0)::int as "timeoutCount",
             coalesce(sum("request_bytes"), 0)::bigint as "requestBytes",
             coalesce(sum("response_bytes"), 0)::bigint as "responseBytes",
             coalesce(sum("duration_sum_ms"), 0)::float8 as "durationSumMs",
             coalesce(max("duration_max_ms"), 0)::float8 as "durationMaxMs",
             jsonb_build_array(${histogramSumSql()}) as "durationHistogram"
           from "http_metric_bucket_item"
           where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?`,
            [range.from, range.to, chooseHttpResolution(range), environmentId],
          ),
        () =>
          executeRows(
            em,
            `select count(distinct "person_handle") filter (
              where "last_seen_at" >= ? and "expires_at" > now()
            )::int as "onlineUsers",
            count(distinct "person_handle") filter (
              where "expires_at" > now()
            )::int as "usersWithSessions"
           from "session_store_item" where "person_handle" is not null`,
            [new Date(Date.now() - ONLINE_WINDOW_MS)],
          ),
        () =>
          executeRows(
            em,
            `select coalesce(sum("total_tokens"), 0)::bigint as "totalTokens",
             count(*)::int as "callCount",
             count(*) filter (where "status" <> 'completed')::int as "errorCount",
             count(*) filter (where "usage_reported")::int as "reportedCount"
           from "ai_usage_event_item" where "occurred_at" between ? and ? and "environment_handle" = ?`,
            [range.from, range.to, environmentId],
          ),
        () =>
          executeRows(
            em,
            `select count(*) filter (where "state" = 'open')::int as "openCount",
             count(*) filter (where "state" = 'open' and "severity" = 'critical')::int as "criticalCount"
           from "system_alert_incident_item" where "environment_handle" = ?`,
            [environmentId],
          ),
        () =>
          executeRows(
            em,
            `select coalesce(sum("request_count"), 0)::int as "requestCount",
             coalesce(sum("server_error_count"), 0)::int as "serverErrorCount",
             coalesce(sum("request_bytes" + "response_bytes"), 0)::bigint as "trafficBytes"
           from "http_metric_bucket_item"
           where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?`,
            [
              previousRange.from,
              previousRange.to,
              chooseHttpResolution(previousRange),
              environmentId,
            ],
          ),
        () =>
          executeRows(
            em,
            `select coalesce(sum("total_tokens"), 0)::bigint as "totalTokens",
             count(*)::int as "callCount"
           from "ai_usage_event_item" where "occurred_at" between ? and ? and "environment_handle" = ?`,
            [previousRange.from, previousRange.to, environmentId],
          ),
      ],
      2,
    );
    const metrics = Object.fromEntries(
      (metricRows as Array<{ metricKey: string; value: number }>).map((row) => [
        row.metricKey,
        Number(row.value),
      ]),
    );
    const http = normalizeNumericRecord(httpRows[0] ?? {});
    const requests = Number(http.requestCount ?? 0);
    const serverErrors = Number(http.serverErrorCount ?? 0);
    const durationP95Ms = percentileFromHistogram(
      http.durationHistogram,
      requests,
      0.95,
    );
    return {
      range: serializeRange(range),
      environment: environmentId,
      lastSampleAt:
        environmentId === this.environment.currentId
          ? this.collector.getStatus().lastSampleAt
          : latestCapturedAt(metricRows),
      health: resolveHealth(metrics, incidentRows[0]),
      metrics,
      requests: {
        ...http,
        averageDurationMs:
          requests > 0 ? Number(http.durationSumMs ?? 0) / requests : 0,
        durationP95Ms,
        serverErrorRate: requests > 0 ? (serverErrors / requests) * 100 : 0,
      },
      users: normalizeNumericRecord(userRows[0] ?? {}),
      ai: normalizeNumericRecord(aiRows[0] ?? {}),
      incidents: normalizeNumericRecord(incidentRows[0] ?? {}),
      slo: {
        apiSuccess: {
          targetPercent: 99.9,
          actualPercent:
            requests > 0 ? ((requests - serverErrors) / requests) * 100 : 100,
          met:
            requests === 0 ||
            ((requests - serverErrors) / requests) * 100 >= 99.9,
        },
        apiP95: {
          targetMs: 1000,
          actualMs: durationP95Ms,
          met: requests === 0 || durationP95Ms <= 1000,
        },
      },
      comparison: {
        previousRange: serializeRange(previousRange),
        requests: normalizeNumericRecord(previousHttpRows[0] ?? {}),
        ai: normalizeNumericRecord(previousAiRows[0] ?? {}),
      },
    };
  }

  async getSeries(query: MonitoringSeriesQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    if (query.metrics.length === 0 || query.metrics.length > 20) {
      throw new BadRequestException('system.monitoringMetricsRequired');
    }
    const resolution =
      query.resolution === 'auto'
        ? chooseMetricResolution(range)
        : query.resolution;
    const em = this.em.fork();
    const rows = await executeRows(
      em,
      `select "metric_key" as "metricKey", "dimension_key" as "dimensionKey",
         "bucket_start" as "capturedAt", "sample_count" as "sampleCount",
         "minimum", "maximum", "sum", "last",
         case when "sample_count" > 0 then "sum" / "sample_count" else null end as "average"
       from "system_metric_bucket_item" metric
       join "system_telemetry_instance_item" instance on instance."handle" = metric."instance_handle"
       where metric."bucket_start" between ? and ? and metric."resolution" = ?
         and instance."environment_handle" = ?
         and "metric_key" in (?)
         and (? = '' or "instance_handle" = ?)
       order by "bucket_start" asc`,
      [
        range.from,
        range.to,
        resolution,
        environmentId,
        query.metrics,
        query.instanceId ?? '',
        query.instanceId ?? '',
      ],
    );
    const ignoredFilesystems = new Set(
      this.collector.getStatus().ignoredFilesystems ?? [],
    );
    return {
      range: serializeRange(range),
      resolution,
      series: rows.filter(
        (row) =>
          row.metricKey !== 'filesystem.usedPercent' ||
          !ignoredFilesystems.has(toDimension(row.dimensionKey)),
      ),
    };
  }

  async getRequests(query: MonitoringGroupQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const resolution = chooseHttpResolution(range);
    const groupColumn = query.groupBy === 'auth' ? 'auth_kind' : 'route_group';
    const [rows, series] = await Promise.all([
      executeRows(
        this.em.fork(),
        `select "${groupColumn}" as "group",
           sum("request_count")::int as "requestCount",
           sum("client_error_count")::int as "clientErrorCount",
           sum("server_error_count")::int as "serverErrorCount",
           sum("aborted_count")::int as "abortedCount",
           sum("timeout_count")::int as "timeoutCount",
           sum("request_bytes")::bigint as "requestBytes",
           sum("response_bytes")::bigint as "responseBytes",
           sum("duration_sum_ms")::float8 as "durationSumMs",
           max("duration_max_ms")::float8 as "durationMaxMs",
           jsonb_build_array(${histogramSumSql()}) as "durationHistogram"
         from "http_metric_bucket_item"
         where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?
         group by "${groupColumn}" order by "requestCount" desc`,
        [range.from, range.to, resolution, environmentId],
      ),
      executeRows(
        this.em.fork(),
        `select 'http.requestCount' as "metricKey", '' as "dimensionKey",
           "bucket_start" as "capturedAt", sum("request_count")::int as "last"
         from "http_metric_bucket_item"
         where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?
         group by "bucket_start" order by "bucket_start" asc`,
        [range.from, range.to, resolution, environmentId],
      ),
    ]);
    return {
      range: serializeRange(range),
      environment: environmentId,
      resolution,
      series,
      groups: rows.map((row) => ({
        ...row,
        durationP50Ms: percentileFromHistogram(
          row.durationHistogram,
          Number(row.requestCount ?? 0),
          0.5,
        ),
        durationP95Ms: percentileFromHistogram(
          row.durationHistogram,
          Number(row.requestCount ?? 0),
          0.95,
        ),
        durationP99Ms: percentileFromHistogram(
          row.durationHistogram,
          Number(row.requestCount ?? 0),
          0.99,
        ),
      })),
    };
  }

  async getUsers(query: MonitoringUsersQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const resolution = chooseHttpResolution(range);
    const order = userSortSql(query.sort);
    const offset = (query.page - 1) * query.limit;
    const em = this.em.fork();
    const rows = await executeRows(
      em,
      `select person."handle", person."first_name" as "firstName",
         person."last_name" as "lastName", person."is_active" as "isActive",
         coalesce(http."requests", 0)::int as "requests",
         coalesce(http."errors", 0)::int as "errors",
         coalesce(http."traffic", 0)::bigint as "traffic",
         http."lastActivityAt", coalesce(ai."tokens", 0)::bigint as "tokens",
         auth."lastLoginAt", coalesce(session."sessionCount", 0)::int as "sessionCount",
         coalesce(session."online", false) as "online"
       from "person_item" person
       left join lateral (
         select sum("request_count") as "requests",
           sum("client_error_count" + "server_error_count") as "errors",
           sum("request_bytes" + "response_bytes") as "traffic",
           max("bucket_start") as "lastActivityAt"
         from "http_metric_bucket_item" h
         where h."person_handle" = person."handle" and h."resolution" = ?
           and h."bucket_start" between ? and ? and h."environment_handle" = ?
       ) http on true
       left join lateral (
         select sum("total_tokens") as "tokens" from "ai_usage_event_item" a
         where a."person_handle" = person."handle" and a."occurred_at" between ? and ? and a."environment_handle" = ?
       ) ai on true
       left join lateral (
         select max("occurred_at") as "lastLoginAt" from "authentication_event_item" a
         where a."person_handle" = person."handle" and a."event_type" = 'loginSuccess' and a."environment_handle" = ?
       ) auth on true
        left join lateral (
          select count(*) filter (where "expires_at" > now()) as "sessionCount",
            bool_or("expires_at" > now() and "last_seen_at" >= ?) as "online"
          from "session_store_item" s where s."person_handle" = person."handle"
        ) session on true
       where exists (
         select 1 from "http_metric_bucket_item" presence
         where presence."person_handle" = person."handle"
           and presence."resolution" = ? and presence."auth_kind" = 'session'
           and presence."environment_handle" = ?
           and presence."bucket_start" between ? and ? and presence."request_count" > 0
       ) or exists (
         select 1 from "authentication_event_item" presence_auth
         where presence_auth."person_handle" = person."handle"
           and presence_auth."event_type" = 'loginSuccess'
           and presence_auth."environment_handle" = ?
           and presence_auth."occurred_at" between ? and ?
       )
       order by ${order} nulls last, person."handle" asc limit ? offset ?`,
      [
        resolution,
        range.from,
        range.to,
        environmentId,
        range.from,
        range.to,
        environmentId,
        environmentId,
        new Date(Date.now() - ONLINE_WINDOW_MS),
        resolution,
        environmentId,
        range.from,
        range.to,
        environmentId,
        range.from,
        range.to,
        query.limit,
        offset,
      ],
    );
    const countRows = await executeRows(
      em,
      `select count(*)::int as "total" from "person_item" person
       where exists (
         select 1 from "http_metric_bucket_item" presence
         where presence."person_handle" = person."handle"
           and presence."resolution" = ? and presence."auth_kind" = 'session'
           and presence."environment_handle" = ?
           and presence."bucket_start" between ? and ? and presence."request_count" > 0
       ) or exists (
         select 1 from "authentication_event_item" presence_auth
         where presence_auth."person_handle" = person."handle"
           and presence_auth."event_type" = 'loginSuccess'
           and presence_auth."environment_handle" = ?
           and presence_auth."occurred_at" between ? and ?
       )`,
      [
        resolution,
        environmentId,
        range.from,
        range.to,
        environmentId,
        range.from,
        range.to,
      ],
    );
    return {
      range: serializeRange(range),
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total: Number(countRows[0]?.total ?? 0),
      },
    };
  }

  async getUser(personHandle: number, query: MonitoringRangeQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const resolution = chooseHttpResolution(range);
    const [userRows, tokens, apiTokens] = await Promise.all([
      executeRows(
        this.em.fork(),
        `select person."handle", person."first_name" as "firstName", person."last_name" as "lastName",
           person."is_active" as "isActive", coalesce(sum(h."request_count"), 0)::int as "requests",
           coalesce(sum(h."client_error_count" + h."server_error_count"), 0)::int as "errors",
           coalesce(sum(h."request_bytes" + h."response_bytes"), 0)::bigint as "traffic",
           max(h."bucket_start") as "lastActivityAt",
           (select max(a."occurred_at") from "authentication_event_item" a
             where a."person_handle" = person."handle" and a."event_type" = 'loginSuccess' and a."environment_handle" = ?) as "lastLoginAt",
           (select count(*) from "session_store_item" s
             where s."person_handle" = person."handle" and s."expires_at" > now())::int as "sessionCount",
           exists(select 1 from "session_store_item" s where s."person_handle" = person."handle"
             and s."expires_at" > now() and s."last_seen_at" >= ?) as "online"
         from "person_item" person left join "http_metric_bucket_item" h
           on h."person_handle" = person."handle" and h."resolution" = ? and h."bucket_start" between ? and ? and h."environment_handle" = ?
         where person."handle" = ? group by person."handle"`,
        [
          environmentId,
          new Date(Date.now() - ONLINE_WINDOW_MS),
          resolution,
          range.from,
          range.to,
          environmentId,
          personHandle,
        ],
      ),
      executeRows(
        this.em.fork(),
        `select "provider", "model", "operation", count(*)::int as "calls",
           coalesce(sum("input_tokens"), 0)::bigint as "inputTokens",
           coalesce(sum("output_tokens"), 0)::bigint as "outputTokens",
           coalesce(sum("total_tokens"), 0)::bigint as "totalTokens"
         from "ai_usage_event_item" where "person_handle" = ? and "occurred_at" between ? and ? and "environment_handle" = ?
         group by "provider", "model", "operation" order by "totalTokens" desc`,
        [personHandle, range.from, range.to, environmentId],
      ),
      executeRows(
        this.em.fork(),
        `select token."handle", token."description", token."token_prefix" as "tokenPrefix",
           token."last_used_at" as "lastUsedAt", coalesce(sum(h."request_count"), 0)::int as "requests",
           coalesce(sum(h."client_error_count" + h."server_error_count"), 0)::int as "errors",
           coalesce(sum(h."request_bytes" + h."response_bytes"), 0)::bigint as "traffic"
         from "person_api_token_item" token
         left join "http_metric_bucket_item" h on h."api_token_handle" = token."handle"
           and h."resolution" = ? and h."bucket_start" between ? and ? and h."environment_handle" = ?
         where token."person_handle" = ?
         group by token."handle" order by token."last_used_at" desc nulls last`,
        [resolution, range.from, range.to, environmentId, personHandle],
      ),
    ]);
    const user = userRows[0];
    if (!user) throw new NotFoundException('global.notFound');
    return { range: serializeRange(range), user, tokens, apiTokens };
  }

  async getAiUsage(query: MonitoringGroupQueryDto) {
    const range = resolveRange(query);
    const environmentId = query.environment || this.environment.currentId;
    const groupExpression = aiGroupSql(query.groupBy);
    const rows = await executeRows(
      this.em.fork(),
      `select ${groupExpression} as "group", count(*)::int as "callCount",
         count(*) filter (where "status" <> 'completed')::int as "errorCount",
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
         latest."request_id" as "latestRequestId",
         latest."correlation_id" as "latestCorrelationId"
       from "system_error_group_item" error_group
       left join lateral (
         select occurrence."error_class", occurrence."message", occurrence."request_id",
           occurrence."correlation_id"
         from "system_error_occurrence_item" occurrence
         where occurrence."group_handle" = error_group."handle"
         order by occurrence."occurred_at" desc limit 1
       ) latest on true
       where error_group."environment_handle" = ?
         and error_group."last_seen_at" between ? and ?
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
           'system_metric_bucket_item'::regclass,
           'http_metric_bucket_item'::regclass,
           'ai_usage_event_item'::regclass,
           'authentication_event_item'::regclass,
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

export function resolveRange(query: MonitoringRangeQueryDto): Range {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to
  ) {
    throw new BadRequestException('system.monitoringInvalidRange');
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new BadRequestException('system.monitoringRangeTooLarge');
  }
  return { from, to };
}

function serializeRange(range: Range) {
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

function latestCapturedAt(rows: Array<Record<string, unknown>>): string | null {
  const timestamps = rows
    .map((row) => {
      const capturedAt = row.capturedAt;
      return capturedAt instanceof Date ||
        typeof capturedAt === 'string' ||
        typeof capturedAt === 'number'
        ? new Date(capturedAt).getTime()
        : Number.NaN;
    })
    .filter(Number.isFinite);
  return timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
}

function chooseMetricResolution(range: Range): '10s' | '1m' | '15m' | '1h' {
  const duration = range.to.getTime() - range.from.getTime();
  if (duration <= 48 * 60 * 60 * 1000) return '10s';
  if (duration <= 7 * 24 * 60 * 60 * 1000) return '1m';
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '15m';
  return '1h';
}

function chooseHttpResolution(range: Range): '1m' | '15m' | '1h' {
  const duration = range.to.getTime() - range.from.getTime();
  if (duration <= 7 * 24 * 60 * 60 * 1000) return '1m';
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '15m';
  return '1h';
}

function userSortSql(sort: string): string {
  return (
    {
      name: 'person."last_name" asc',
      lastActivityAt: 'http."lastActivityAt" desc',
      requests: 'http."requests" desc',
      errors: 'http."errors" desc',
      traffic: 'http."traffic" desc',
      tokens: 'ai."tokens" desc',
    }[sort] ?? 'http."lastActivityAt" desc'
  );
}

function aiGroupSql(groupBy: string): string {
  if (groupBy === 'model') return `coalesce("model", 'unknown')`;
  if (groupBy === 'person') return `coalesce("person_handle"::text, 'system')`;
  if (groupBy === 'day') return `date_trunc('day', "occurred_at")`;
  return `coalesce("provider", 'unknown')`;
}

function normalizeNumericRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      const numeric =
        typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : value;
      return [
        key,
        typeof numeric === 'number' && Number.isFinite(numeric)
          ? numeric
          : value,
      ];
    }),
  );
}

function toDimension(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

function resolveHealth(
  metrics: Record<string, number>,
  incidents: Record<string, unknown> | undefined,
): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (Number(incidents?.criticalCount ?? 0) > 0) return 'critical';
  if (Number(incidents?.openCount ?? 0) > 0) return 'warning';
  return Object.keys(metrics).length > 0 ? 'healthy' : 'unknown';
}

function histogramSumSql(): string {
  return Array.from(
    { length: 10 },
    (_, index) => `sum(coalesce(("duration_histogram"->>${index})::int, 0))`,
  ).join(', ');
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextTask = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), tasks.length) },
    async () => {
      while (nextTask < tasks.length) {
        const index = nextTask;
        nextTask += 1;
        results[index] = await tasks[index]();
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function percentileFromHistogram(
  histogram: unknown,
  count: number,
  percentile: number,
): number {
  if (!Array.isArray(histogram) || count <= 0) return 0;
  const limits = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 10000];
  const target = Math.ceil(count * percentile);
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += Number(histogram[index] ?? 0);
    if (cumulative >= target) return limits[index] ?? limits[limits.length - 1];
  }
  return limits[limits.length - 1];
}
