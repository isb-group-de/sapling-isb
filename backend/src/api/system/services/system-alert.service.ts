import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SystemAlertIncidentItem } from '../../../entity/SystemAlertIncidentItem';
import { SystemAlertRuleItem } from '../../../entity/SystemAlertRuleItem';
import { SYSTEM_TELEMETRY_ENABLED } from '../../../constants/project.constants';
import { SystemAlertNotificationService } from './system-alert-notification.service';
import { FilesystemService } from './filesystem.service';

@Injectable()
export class SystemAlertService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private evaluating = false;

  constructor(
    private readonly em: EntityManager,
    private readonly notifications: SystemAlertNotificationService,
    private readonly filesystemService: FilesystemService,
  ) {}

  onModuleInit(): void {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    this.timer = setInterval(() => void this.evaluate(), 60_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async evaluate(): Promise<void> {
    if (this.evaluating) return;
    this.evaluating = true;
    try {
      const em = this.em.fork();
      const rules = await em.find(SystemAlertRuleItem, { isActive: true });
      rules.sort(
        (left, right) =>
          severityRank(right.severity) - severityRank(left.severity),
      );
      const criticalDimensions = new Set<string>();
      const ignoredFilesystems = new Set(
        this.filesystemService.getIgnoredFilesystemDimensions(),
      );
      for (const rule of rules) {
        const observations = await this.readObservations(em, rule);
        const triggeredDimensions = new Set<string>();
        for (const observation of observations) {
          if (
            rule.metricKey === 'filesystem.usedPercent' &&
            ignoredFilesystems.has(observation.dimension)
          )
            continue;
          if (observation.count < rule.minimumCount) continue;
          if (!compare(observation.value, rule.comparator, rule.threshold))
            continue;
          const metricDimension = `${rule.metricKey}:${observation.dimension}`;
          if (
            rule.severity === 'warning' &&
            criticalDimensions.has(metricDimension)
          ) {
            await this.resolveIncident(em, rule, observation.dimension);
            continue;
          }
          triggeredDimensions.add(observation.dimension);
          await this.openOrUpdateIncident(em, rule, observation);
          if (rule.severity === 'critical')
            criticalDimensions.add(metricDimension);
        }
        const open = await em.find(SystemAlertIncidentItem, {
          rule,
          state: 'open',
        });
        for (const incident of open) {
          normalizeGeneratedHandle(incident);
          if (
            rule.metricKey === 'filesystem.usedPercent' &&
            ignoredFilesystems.has(incident.dimensionKey)
          ) {
            incident.healthyEvaluations = 3;
            incident.state = 'resolved';
            incident.resolvedAt = new Date();
            continue;
          }
          if (triggeredDimensions.has(incident.dimensionKey)) continue;
          incident.healthyEvaluations += 1;
          if (incident.healthyEvaluations >= 3) {
            incident.state = 'resolved';
            incident.resolvedAt = new Date();
          }
        }
      }
      await em.flush();
    } catch (error) {
      global.log?.error?.('system alert evaluation failed', error);
    } finally {
      this.evaluating = false;
    }
  }

  private async resolveIncident(
    em: EntityManager,
    rule: SystemAlertRuleItem,
    dimension: string,
  ): Promise<void> {
    const incident = await em.findOne(SystemAlertIncidentItem, {
      fingerprint: `${rule.handle}:${dimension}`,
      state: 'open',
    });
    if (!incident) return;
    normalizeGeneratedHandle(incident);
    incident.healthyEvaluations = 3;
    incident.state = 'resolved';
    incident.resolvedAt = new Date();
  }

  private async readObservations(em: EntityManager, rule: SystemAlertRuleItem) {
    const since = new Date(Date.now() - rule.windowSeconds * 1000);
    if (rule.metricKey === 'http.5xxRate') {
      const rows = await em.getConnection().execute(
        `select '' as "dimension",
           case when sum("request_count") > 0
             then sum("server_error_count")::float8 / sum("request_count") * 100 else 0 end as "value",
           coalesce(sum("request_count"), 0)::int as "count"
         from "http_metric_bucket_item" where "resolution" = '1m' and "bucket_start" >= ?`,
        [since],
      );
      return normalizeObservations(rows);
    }
    if (rule.metricKey === 'ai.errorRate') {
      const rows = await em.getConnection().execute(
        `select '' as "dimension",
           case when count(*) > 0
             then count(*) filter (where "status" <> 'completed')::float8 / count(*) * 100 else 0 end as "value",
           count(*)::int as "count"
         from "ai_usage_event_item" where "occurred_at" >= ?`,
        [since],
      );
      return normalizeObservations(rows);
    }
    if (rule.metricKey === 'user.ai.totalTokens') {
      const rows = await em.getConnection().execute(
        `select "person_handle"::text as "dimension",
           coalesce(sum("total_tokens"), 0)::float8 as "value", count(*)::int as "count"
         from "ai_usage_event_item"
         where "occurred_at" >= ? and "person_handle" is not null
         group by "person_handle"`,
        [since],
      );
      return normalizeObservations(rows);
    }
    if (rule.metricKey === 'user.http.trafficBytes') {
      const rows = await em.getConnection().execute(
        `select "person_handle"::text as "dimension",
           coalesce(sum("request_bytes" + "response_bytes"), 0)::float8 as "value",
           coalesce(sum("request_count"), 0)::int as "count"
         from "http_metric_bucket_item"
         where "bucket_start" >= ? and "resolution" = '1m' and "person_handle" is not null
         group by "person_handle"`,
        [since],
      );
      return normalizeObservations(rows);
    }
    if (rule.metricKey === 'http.p95Ms') {
      const histogram = Array.from(
        { length: 10 },
        (_, index) =>
          `sum(coalesce(("duration_histogram"->>${index})::int, 0))`,
      ).join(', ');
      const rows = await em.getConnection().execute(
        `select jsonb_build_array(${histogram}) as "histogram",
           coalesce(sum("request_count"), 0)::int as "count"
         from "http_metric_bucket_item" where "resolution" = '1m' and "bucket_start" >= ?`,
        [since],
      );
      const count = Number(rows[0]?.count ?? 0);
      return [
        {
          dimension: '',
          value: histogramPercentile(rows[0]?.histogram, count, 0.95),
          count,
        },
      ];
    }
    if (rule.metricKey === 'collector.gapSeconds') {
      const rows = await em.getConnection().execute(
        `select "handle" as "dimension",
           extract(epoch from now() - "last_sample_at")::float8 as "value", 1 as "count"
         from "system_telemetry_instance_item" where "collector_enabled" = true`,
      );
      return normalizeObservations(rows);
    }
    const rows = await em.getConnection().execute(
      `select "dimension_key" as "dimension", avg("sum" / greatest("sample_count", 1))::float8 as "value",
         sum("sample_count")::int as "count"
       from "system_metric_bucket_item"
       where "metric_key" = ? and "resolution" = '10s' and "bucket_start" >= ?
       group by "dimension_key"`,
      [rule.metricKey, since],
    );
    return normalizeObservations(rows);
  }

  private async openOrUpdateIncident(
    em: EntityManager,
    rule: SystemAlertRuleItem,
    observation: { dimension: string; value: number; count: number },
  ) {
    const fingerprint = `${rule.handle}:${observation.dimension}`;
    let incident = await em.findOne(SystemAlertIncidentItem, {
      fingerprint,
      state: 'open',
    });
    if (incident) normalizeGeneratedHandle(incident);
    if (!incident) {
      incident = em.create(SystemAlertIncidentItem, {
        rule,
        fingerprint,
        dimensionKey: observation.dimension,
        severity: rule.severity,
        observedValue: observation.value,
        threshold: rule.threshold,
        state: 'open',
        healthyEvaluations: 0,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await em.flush();
      normalizeGeneratedHandle(incident);
      try {
        await this.notifications.notifyOpened(incident);
        incident.notifiedSeverity = incident.severity;
      } catch (error) {
        global.log?.error?.('system alert inbox notification failed', error);
      }
      return;
    }
    incident.lastSeenAt = new Date();
    incident.observedValue = observation.value;
    incident.threshold = rule.threshold;
    incident.severity = rule.severity;
    incident.healthyEvaluations = 0;
  }
}

function severityRank(severity: SystemAlertRuleItem['severity']): number {
  return severity === 'critical' ? 2 : 1;
}

function normalizeGeneratedHandle(incident: SystemAlertIncidentItem): void {
  const handle = incident.handle as number | string | undefined;
  if (typeof handle !== 'string') return;
  const numericHandle = Number(handle);
  if (Number.isSafeInteger(numericHandle)) incident.handle = numericHandle;
}

function compare(
  value: number,
  comparator: SystemAlertRuleItem['comparator'],
  threshold: number,
): boolean {
  if (comparator === 'gte') return value >= threshold;
  if (comparator === 'lt') return value < threshold;
  if (comparator === 'lte') return value <= threshold;
  return value > threshold;
}

function normalizeObservations(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      dimension: String(record.dimension ?? ''),
      value: Number(record.value ?? 0),
      count: Number(record.count ?? 0),
    };
  });
}

function histogramPercentile(
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
    if (cumulative >= target) return limits[index] ?? 10000;
  }
  return 10000;
}
