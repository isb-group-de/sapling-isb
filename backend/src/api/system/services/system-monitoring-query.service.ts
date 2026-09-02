import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
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
import { SystemMonitoringOperationsQuery } from './system-monitoring-operations.query';
import {
  loadLatestCheckStatuses,
  toCheckStatuses,
} from './system-monitoring-health.query';
import {
  chooseHttpResolution,
  chooseMetricResolution,
  histogramSumSql,
  httpGroupSql,
  latestCapturedAt,
  metricResolutionRank,
  normalizeNumericRecord,
  percentileFromHistogram,
  resolveHealth,
  resolveRange,
  runWithConcurrency,
  serializeRange,
  toDimension,
  userSortSql,
} from './system-monitoring-query.utils';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class SystemMonitoringQueryService {
  private readonly operations: SystemMonitoringOperationsQuery;

  constructor(
    private readonly em: EntityManager,
    private readonly collector: SystemTelemetryCollectorService,
    private readonly httpTelemetry: HttpTelemetryService,
    private readonly environment: SystemTelemetryEnvironmentService,
  ) {
    this.operations = new SystemMonitoringOperationsQuery(
      em,
      collector,
      httpTelemetry,
      environment,
    );
  }

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
      checkRows,
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
            where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?
              and "request_kind" = 'standard'`,
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
             count(*) filter (where "status" in ('completed', 'failed'))::int as "terminalCount",
             count(*) filter (where "status" = 'failed')::int as "errorCount",
             count(*) filter (where "status" in ('interrupted', 'cancelled'))::int as "interruptedCount",
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
        () => loadLatestCheckStatuses(em, environmentId, range),
        () =>
          executeRows(
            em,
            `select coalesce(sum("request_count"), 0)::int as "requestCount",
             coalesce(sum("server_error_count"), 0)::int as "serverErrorCount",
             coalesce(sum("request_bytes" + "response_bytes"), 0)::bigint as "trafficBytes"
           from "http_metric_bucket_item"
            where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?
              and "request_kind" = 'standard'`,
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
      health: resolveHealth(
        metrics,
        incidentRows[0],
        toCheckStatuses(checkRows),
      ),
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
    const requestedResolutionRank = metricResolutionRank(resolution);
    const rows = await executeRows(
      em,
      `with candidates as (
        select metric.*,
          case metric."resolution" when '10s' then 0 when '1m' then 1 when '15m' then 2 else 3 end as "resolutionRank"
        from "system_metric_bucket_item" metric
        join "system_telemetry_instance_item" instance on instance."handle" = metric."instance_handle"
        where metric."bucket_start" between ? and ? and instance."environment_handle" = ?
          and metric."metric_key" in (?)
          and (? = '' or metric."instance_handle" = ?)
      ), choices as (
        select "metric_key",
          coalesce(
            min("resolutionRank") filter (where "resolutionRank" >= ?),
            max("resolutionRank") filter (where "resolutionRank" < ?)
          ) as "resolutionRank"
        from candidates group by "metric_key"
      )
      select candidates."metric_key" as "metricKey",
        candidates."dimension_key" as "dimensionKey",
        candidates."bucket_start" as "capturedAt",
        candidates."resolution", candidates."sample_count" as "sampleCount",
        candidates."minimum", candidates."maximum", candidates."sum", candidates."last",
        case when candidates."sample_count" > 0
          then candidates."sum" / candidates."sample_count" else null end as "average"
      from candidates join choices using ("metric_key", "resolutionRank")
      order by candidates."bucket_start" asc`,
      [
        range.from,
        range.to,
        environmentId,
        query.metrics,
        query.instanceId ?? '',
        query.instanceId ?? '',
        requestedResolutionRank,
        requestedResolutionRank,
      ],
    );
    const ignoredFilesystems = new Set(
      this.collector.getStatus().ignoredFilesystems ?? [],
    );
    const resolutionRows = rows as Array<{
      metricKey: string;
      resolution: string;
    }>;
    return {
      range: serializeRange(range),
      resolution,
      resolutionByMetric: Object.fromEntries(
        resolutionRows.map((row) => [row.metricKey, row.resolution]),
      ),
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
    const groupExpression = httpGroupSql(query.groupBy);
    const [rows, series] = await Promise.all([
      executeRows(
        this.em.fork(),
        `select ${groupExpression} as "group",
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
            and (? = 'all' or "request_kind" = ?)
          group by ${groupExpression} order by "requestCount" desc`,
        [
          range.from,
          range.to,
          resolution,
          environmentId,
          query.requestKind,
          query.requestKind,
        ],
      ),
      executeRows(
        this.em.fork(),
        `select 'http.requestCount' as "metricKey", '' as "dimensionKey",
           "bucket_start" as "capturedAt", sum("request_count")::int as "last"
         from "http_metric_bucket_item"
          where "bucket_start" between ? and ? and "resolution" = ? and "environment_handle" = ?
            and (? = 'all' or "request_kind" = ?)
          group by "bucket_start" order by "bucket_start" asc`,
        [
          range.from,
          range.to,
          resolution,
          environmentId,
          query.requestKind,
          query.requestKind,
        ],
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
            and h."request_kind" = 'standard'
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
            and presence."request_kind" = 'standard'
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
            and presence."request_kind" = 'standard'
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
              and h."request_kind" = 'standard'
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
            and h."request_kind" = 'standard'
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
    return this.operations.getAiUsage(query);
  }

  async getIncidents(query: MonitoringRangeQueryDto = {}) {
    return this.operations.getIncidents(query);
  }

  async getIncident(handle: number, query: MonitoringRangeQueryDto = {}) {
    return this.operations.getIncident(handle, query);
  }

  async getAlertRules() {
    return this.operations.getAlertRules();
  }

  async updateAlertRule(handle: string, dto: UpdateSystemAlertRuleDto) {
    return this.operations.updateAlertRule(handle, dto);
  }

  async getEnvironments() {
    return this.operations.getEnvironments();
  }

  async getServices(query: MonitoringRangeQueryDto) {
    return this.operations.getServices(query);
  }

  async getErrors(query: MonitoringRangeQueryDto) {
    return this.operations.getErrors(query);
  }

  async getChecks(query: MonitoringRangeQueryDto) {
    return this.operations.getChecks(query);
  }

  async getRemediations(query: MonitoringRangeQueryDto) {
    return this.operations.getRemediations(query);
  }

  async getCollectorStatus(query: MonitoringRangeQueryDto = {}) {
    return this.operations.getCollectorStatus(query);
  }
}
