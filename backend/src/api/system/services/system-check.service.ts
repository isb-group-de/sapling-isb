import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { performance } from 'perf_hooks';
import { SYSTEM_MONITORING_CHECKS_ENABLED } from '../../../constants/project.constants';
import { SystemTelemetryCollectorService } from './system-telemetry-collector.service';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';

type CheckResult = {
  checkKey: string;
  category: string;
  status: 'healthy' | 'warning' | 'critical';
  durationMs: number;
  summary?: string;
};

@Injectable()
export class SystemCheckService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastCanaryAt = 0;

  constructor(
    private readonly em: EntityManager,
    private readonly collector: SystemTelemetryCollectorService,
    private readonly environment: SystemTelemetryEnvironmentService,
  ) {}

  onModuleInit(): void {
    if (!SYSTEM_MONITORING_CHECKS_ENABLED) return;
    this.timer = setInterval(() => void this.runAll(), 60_000);
    this.timer.unref();
    setTimeout(() => void this.runAll(), 5_000).unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll(): Promise<CheckResult[]> {
    if (!SYSTEM_MONITORING_CHECKS_ENABLED || this.running) return [];
    this.running = true;
    const em = this.em.fork();
    try {
      await this.environment.ensure(em);
      return await em.transactional(async (transaction) => {
        const locked = (await transaction
          .getConnection()
          .execute(
            `select pg_try_advisory_xact_lock(hashtext(?)) as "locked"`,
            [`system-checks:${this.environment.currentId}`],
          )) as Array<{ locked: boolean }>;
        if (!locked[0]?.locked) return [];
        const results = [
          await this.checkDatabase(transaction),
          this.checkCollector(),
          ...(await this.checkOperationalSignals(transaction)),
        ];
        if (Date.now() - this.lastCanaryAt >= 5 * 60_000) {
          results.push(await this.checkCanaryLifecycle(transaction));
          this.lastCanaryAt = Date.now();
        }
        for (const result of results) await this.persist(transaction, result);
        return results;
      });
    } catch (error) {
      global.log?.warn?.('system checks failed', error);
      return [];
    } finally {
      this.running = false;
    }
  }

  private async checkDatabase(em: EntityManager): Promise<CheckResult> {
    const startedAt = performance.now();
    try {
      await em.getConnection().execute('select 1');
      const durationMs = Math.round(performance.now() - startedAt);
      return {
        checkKey: 'database.connectivity',
        category: 'database',
        status: durationMs > 500 ? 'warning' : 'healthy',
        durationMs,
        summary: durationMs > 500 ? 'database response is slow' : undefined,
      };
    } catch (error) {
      return {
        checkKey: 'database.connectivity',
        category: 'database',
        status: 'critical',
        durationMs: Math.round(performance.now() - startedAt),
        summary: safeSummary(error),
      };
    }
  }

  private checkCollector(): CheckResult {
    const status = this.collector.getStatus();
    const lastSampleAt = status.lastSampleAt
      ? new Date(status.lastSampleAt).getTime()
      : 0;
    const gapSeconds = lastSampleAt
      ? Math.max(0, (Date.now() - lastSampleAt) / 1000)
      : Infinity;
    return {
      checkKey: 'telemetry.collector',
      category: 'telemetry',
      status:
        gapSeconds > 120 ? 'critical' : gapSeconds > 60 ? 'warning' : 'healthy',
      durationMs: 0,
      summary: Number.isFinite(gapSeconds)
        ? `${Math.round(gapSeconds)}s since last sample`
        : 'no sample',
    };
  }

  private async checkOperationalSignals(
    em: EntityManager,
  ): Promise<CheckResult[]> {
    try {
      const [metrics, http, ai, frontendErrors] = await Promise.all([
        em.getConnection().execute(
          `select "metric_key" as "metricKey", max("last")::float8 as "value"
           from "system_metric_bucket_item" metric
           join "system_telemetry_instance_item" instance on instance."handle" = metric."instance_handle"
           where instance."environment_handle" = ? and metric."bucket_start" >= now() - interval '3 minutes'
             and metric."metric_key" in ('queue.failed', 'queue.oldestWaitingSeconds',
               'filesystem.usedPercent', 'database.connectionUsedPercent', 'web.lcpMs', 'web.inpMs', 'web.cls')
           group by "metric_key"`,
          [this.environment.currentId],
        ) as Promise<Array<{ metricKey: string; value: number }>>,
        em.getConnection().execute(
          `select coalesce(sum("request_count"), 0)::int as "total",
             coalesce(sum("server_error_count"), 0)::int as "errors",
             coalesce(sum("timeout_count"), 0)::int as "timeouts"
           from "http_metric_bucket_item" where "environment_handle" = ?
             and "resolution" = '1m' and "bucket_start" >= now() - interval '5 minutes'`,
          [this.environment.currentId],
        ) as Promise<
          Array<{ total: number; errors: number; timeouts: number }>
        >,
        em.getConnection().execute(
          `select count(*)::int as "total",
             count(*) filter (where "status" <> 'completed')::int as "errors"
           from "ai_usage_event_item" where "environment_handle" = ?
             and "occurred_at" >= now() - interval '15 minutes'`,
          [this.environment.currentId],
        ) as Promise<Array<{ total: number; errors: number }>>,
        em.getConnection().execute(
          `select count(*)::int as "errors" from "system_error_occurrence_item"
           where "environment_handle" = ? and "source" = 'frontend'
             and "occurred_at" >= now() - interval '5 minutes'`,
          [this.environment.currentId],
        ) as Promise<Array<{ errors: number }>>,
      ]);
      const values = new Map(
        metrics.map((row) => [row.metricKey, Number(row.value)]),
      );
      const queueFailed = values.get('queue.failed') ?? 0;
      const queueAge = values.get('queue.oldestWaitingSeconds') ?? 0;
      const filesystem = values.get('filesystem.usedPercent') ?? 0;
      const connectionUsage = values.get('database.connectionUsedPercent') ?? 0;
      const httpTotal = Number(http[0]?.total ?? 0);
      const httpFailures =
        Number(http[0]?.errors ?? 0) + Number(http[0]?.timeouts ?? 0);
      const httpRate = httpTotal > 0 ? (httpFailures / httpTotal) * 100 : 0;
      const aiTotal = Number(ai[0]?.total ?? 0);
      const aiErrors = Number(ai[0]?.errors ?? 0);
      const aiRate = aiTotal > 0 ? (aiErrors / aiTotal) * 100 : 0;
      const lcp = values.get('web.lcpMs') ?? 0;
      const inp = values.get('web.inpMs') ?? 0;
      const cls = values.get('web.cls') ?? 0;
      const browserErrors = Number(frontendErrors[0]?.errors ?? 0);
      return [
        signalCheck(
          'database.capacity',
          'database',
          connectionUsage,
          80,
          95,
          '% connections',
        ),
        combinedCheck(
          'queue.flow',
          'queue',
          [severity(queueFailed, 1, 25), severity(queueAge, 300, 900)],
          `${Math.round(queueAge)}s oldest · ${Math.round(queueFailed)} failed`,
        ),
        signalCheck(
          'storage.capacity',
          'storage',
          filesystem,
          85,
          95,
          '% filesystem',
        ),
        signalCheck('http.reliability', 'http', httpRate, 1, 5, '% failures'),
        combinedCheck(
          'frontend.experience',
          'frontend',
          [
            severity(lcp, 2500, 4000),
            severity(inp, 200, 500),
            severity(cls, 0.1, 0.25),
            severity(browserErrors, 1, 10),
          ],
          `LCP ${Math.round(lcp)}ms · INP ${Math.round(inp)}ms · ${browserErrors} errors`,
        ),
        signalCheck('ai.reliability', 'ai', aiRate, 5, 20, '% failures'),
      ];
    } catch (error) {
      global.log?.warn?.('operational system checks failed', error);
      return [];
    }
  }

  private async checkCanaryLifecycle(em: EntityManager): Promise<CheckResult> {
    const startedAt = performance.now();
    const marker = `canary-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let inserted = false;
    try {
      await em
        .getConnection()
        .execute(
          `insert into "system_canary_record_item" ("marker", "created_at") values (?, now())`,
          [marker],
        );
      inserted = true;
      const rows = (await em
        .getConnection()
        .execute(
          `select "marker" from "system_canary_record_item" where "marker" = ?`,
          [marker],
        )) as Array<{ marker: string }>;
      if (rows[0]?.marker !== marker) throw new Error('canary read mismatch');
      await em
        .getConnection()
        .execute(`delete from "system_canary_record_item" where "marker" = ?`, [
          marker,
        ]);
      return {
        checkKey: 'application.canaryLifecycle',
        category: 'application',
        status: 'healthy',
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      if (inserted) {
        try {
          await em
            .getConnection()
            .execute(
              `delete from "system_canary_record_item" where "marker" = ?`,
              [marker],
            );
        } catch {
          // The critical check result is the durable signal for cleanup failure.
        }
      }
      return {
        checkKey: 'application.canaryLifecycle',
        category: 'application',
        status: 'critical',
        durationMs: Math.round(performance.now() - startedAt),
        summary: safeSummary(error),
      };
    }
  }

  private async persist(em: EntityManager, result: CheckResult): Promise<void> {
    await em.getConnection().execute(
      `insert into "system_check_run_item" (
        "environment_handle", "check_key", "category", "status", "duration_ms",
        "summary", "steps", "started_at", "completed_at"
      ) values (?, ?, ?, ?, ?, ?, null, now(), now())`,
      [
        this.environment.currentId,
        result.checkKey,
        result.category,
        result.status,
        result.durationMs,
        result.summary ?? null,
      ],
    );
  }
}

function safeSummary(error: unknown): string {
  return (error instanceof Error ? error.name : 'database check failed').slice(
    0,
    500,
  );
}

function severity(
  value: number,
  warning: number,
  critical: number,
): CheckResult['status'] {
  return value >= critical
    ? 'critical'
    : value >= warning
      ? 'warning'
      : 'healthy';
}

function signalCheck(
  checkKey: string,
  category: string,
  value: number,
  warning: number,
  critical: number,
  unit: string,
): CheckResult {
  return {
    checkKey,
    category,
    status: severity(value, warning, critical),
    durationMs: 0,
    summary: `${Number(value.toFixed(2))}${unit}`,
  };
}

function combinedCheck(
  checkKey: string,
  category: string,
  states: CheckResult['status'][],
  summary: string,
): CheckResult {
  const status = states.includes('critical')
    ? 'critical'
    : states.includes('warning')
      ? 'warning'
      : 'healthy';
  return { checkKey, category, status, durationMs: 0, summary };
}
