import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import systeminformation from 'systeminformation';
import os from 'os';
import { randomUUID } from 'crypto';
import { monitorEventLoopDelay } from 'perf_hooks';
import { Queue } from 'bullmq';
import {
  REDIS_ENABLED,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_SERVER,
  REDIS_USERNAME,
  SYSTEM_TELEMETRY_ENABLED,
  SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS,
} from '../../../constants/project.constants';
import { DatabaseService } from './database.service';
import { DocumentStorageService } from './document-storage.service';
import { VersionService } from './version.service';
import { TelemetrySpoolService } from './telemetry-spool.service';
import { FilesystemService } from './filesystem.service';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';
import { SYSTEM_PROCESS_SLOT } from './system-telemetry-context';
import { HttpTelemetryService } from './http-telemetry.service';

type NumericMetric = {
  key: string;
  value: number;
  dimension?: string;
};

@Injectable()
export class SystemTelemetryCollectorService
  implements OnModuleInit, OnApplicationShutdown
{
  readonly bootId = randomUUID();
  readonly instanceId = `${SYSTEM_PROCESS_SLOT}:${this.bootId}`.slice(0, 128);
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;
  private lastSampleAt: Date | null = null;
  private lastError: string | null = null;
  private sampleCount = 0;
  private previousCpuUsage = process.cpuUsage();
  private previousCpuMeasuredAt = process.hrtime.bigint();
  private lastMinuteCollectionAt = 0;
  private lastExpensiveCollectionAt = 0;
  private queues: Queue[] = [];

  constructor(
    private readonly em: EntityManager,
    private readonly databaseService: DatabaseService,
    private readonly documentStorageService: DocumentStorageService,
    private readonly versionService: VersionService,
    private readonly spool: TelemetrySpoolService,
    private readonly filesystemService: FilesystemService,
    private readonly environment: SystemTelemetryEnvironmentService,
    private readonly httpTelemetry: HttpTelemetryService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    await this.prepareInstance();
    if (REDIS_ENABLED) {
      this.queues = MONITORED_QUEUE_NAMES.map(
        (name) =>
          new Queue(name, {
            connection: {
              host: REDIS_SERVER,
              port: REDIS_PORT,
              username: REDIS_USERNAME || undefined,
              password: REDIS_PASSWORD || undefined,
            },
          }),
      );
    }
    this.eventLoopDelay.enable();
    this.startupTimer = setTimeout(() => void this.collect(), 1_000);
    this.startupTimer.unref();
    this.timer = setInterval(
      () => void this.collect(),
      SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS,
    );
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.timer) clearInterval(this.timer);
    this.eventLoopDelay.disable();
    await this.markStopped();
    await Promise.allSettled(this.queues.map((queue) => queue.close()));
  }

  getStatus() {
    return {
      enabled: SYSTEM_TELEMETRY_ENABLED,
      instanceId: this.instanceId,
      environmentId: this.environment.currentId,
      processSlot: SYSTEM_PROCESS_SLOT,
      bootId: this.bootId,
      sampleIntervalMs: SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS,
      running: this.running,
      sampleCount: this.sampleCount,
      lastSampleAt: this.lastSampleAt?.toISOString() ?? null,
      lastError: this.lastError,
      spool: this.spool.getStatus(),
      ignoredFilesystems:
        this.filesystemService.getIgnoredFilesystemDimensions(),
    };
  }

  async collect(): Promise<void> {
    if (!SYSTEM_TELEMETRY_ENABLED || this.running) return;
    this.running = true;
    const now = new Date();
    try {
      const [load, memory, network] = await Promise.all([
        safeSource('cpu', () => systeminformation.currentLoad()),
        safeSource('memory', () => systeminformation.mem()),
        safeSource('network', () => systeminformation.networkStats()),
      ]);
      const processMemory = process.memoryUsage();
      const loadAverage = os.loadavg();
      const metrics: NumericMetric[] = [
        { key: 'host.load.1m', value: loadAverage[0] ?? 0 },
        { key: 'host.load.5m', value: loadAverage[1] ?? 0 },
        { key: 'host.load.15m', value: loadAverage[2] ?? 0 },
        { key: 'process.memory.rssBytes', value: processMemory.rss },
        { key: 'process.memory.heapUsedBytes', value: processMemory.heapUsed },
        {
          key: 'process.memory.heapTotalBytes',
          value: processMemory.heapTotal,
        },
        { key: 'process.memory.externalBytes', value: processMemory.external },
        { key: 'process.cpu.percent', value: this.measureProcessCpuPercent() },
        {
          key: 'process.eventLoop.p95Ms',
          value: finiteNumber(this.eventLoopDelay.percentile(95) / 1_000_000),
        },
        { key: 'process.uptimeSeconds', value: process.uptime() },
        {
          key: 'process.startedAtEpochMs',
          value: Date.now() - process.uptime() * 1000,
        },
        {
          key: 'http.activeRequests',
          value: this.httpTelemetry.getStatus().activeRequests,
        },
      ];

      if (load) {
        metrics.push(
          { key: 'host.cpu.percent', value: load.currentLoad },
          { key: 'host.cpu.userPercent', value: load.currentLoadUser },
          { key: 'host.cpu.systemPercent', value: load.currentLoadSystem },
        );
      }
      if (memory) {
        metrics.push(
          { key: 'host.memory.totalBytes', value: memory.total },
          { key: 'host.memory.usedBytes', value: memory.used },
          {
            key: 'host.memory.usedPercent',
            value: percentage(memory.used, memory.total),
          },
          { key: 'host.memory.availableBytes', value: memory.available },
          { key: 'host.swap.usedBytes', value: memory.swapused },
          {
            key: 'host.swap.usedPercent',
            value: percentage(memory.swapused, memory.swaptotal),
          },
        );
      }

      this.eventLoopDelay.reset();
      for (const item of network ?? []) {
        const dimension = sanitizeDimension(item.iface ?? 'unknown');
        metrics.push(
          {
            key: 'network.rxBytesPerSecond',
            value: item.rx_sec ?? 0,
            dimension,
          },
          {
            key: 'network.txBytesPerSecond',
            value: item.tx_sec ?? 0,
            dimension,
          },
          { key: 'network.rxErrors', value: item.rx_errors ?? 0, dimension },
          { key: 'network.txErrors', value: item.tx_errors ?? 0, dimension },
          { key: 'network.rxDropped', value: item.rx_dropped ?? 0, dimension },
          { key: 'network.txDropped', value: item.tx_dropped ?? 0, dimension },
        );
      }

      if (now.getTime() - this.lastMinuteCollectionAt >= 60_000) {
        this.lastMinuteCollectionAt = now.getTime();
        const [filesystems, database, databaseRuntime] = await Promise.all([
          safeSource('filesystem', () =>
            this.filesystemService.getFilesystem(),
          ),
          safeSource('database', () => this.databaseService.getDatabase()),
          safeSource('database-runtime', () => this.collectDatabaseRuntime()),
        ]);
        for (const filesystem of filesystems ?? []) {
          const dimension = sanitizeDimension(
            filesystem.mount || filesystem.fs || 'unknown',
          );
          metrics.push(
            {
              key: 'filesystem.usedPercent',
              value: filesystem.use ?? 0,
              dimension,
            },
            {
              key: 'filesystem.usedBytes',
              value: filesystem.used ?? 0,
              dimension,
            },
            {
              key: 'filesystem.sizeBytes',
              value: filesystem.size ?? 0,
              dimension,
            },
          );
        }
        if (database) {
          metrics.push(
            {
              key: 'database.activeConnections',
              value: database.activeConnections,
            },
            { key: 'database.maxConnections', value: database.maxConnections },
            {
              key: 'database.connectionUsedPercent',
              value: percentage(
                database.activeConnections,
                database.maxConnections,
              ),
            },
          );
        }
        if (databaseRuntime) metrics.push(...databaseRuntime);
        const queueCounts = await Promise.all(
          this.queues.map(async (queue) => {
            const pingStartedAt = performance.now();
            const [counts, paused, oldestWaiting] = await Promise.all([
              safeSource(`queue:${queue.name}`, () =>
                queue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
              ),
              safeSource(`queue:${queue.name}:paused`, () => queue.isPaused()),
              safeSource(`queue:${queue.name}:oldest`, () =>
                queue.getWaiting(0, 0),
              ),
            ]);
            const countRecord = counts as unknown as Record<
              string,
              unknown
            > | null;
            return {
              name: queue.name,
              counts: countRecord
                ? {
                    waiting: Number(countRecord.waiting ?? 0),
                    active: Number(countRecord.active ?? 0),
                    failed: Number(countRecord.failed ?? 0),
                    delayed: Number(countRecord.delayed ?? 0),
                    paused: paused ? 1 : 0,
                  }
                : null,
              pingMs: performance.now() - pingStartedAt,
              oldestWaitingSeconds:
                Array.isArray(oldestWaiting) && oldestWaiting[0]?.timestamp
                  ? Math.max(
                      0,
                      (Date.now() - oldestWaiting[0].timestamp) / 1000,
                    )
                  : 0,
            };
          }),
        );
        for (const queue of queueCounts) {
          if (!queue.counts) continue;
          for (const state of [
            'waiting',
            'active',
            'failed',
            'delayed',
            'paused',
          ] as const) {
            metrics.push({
              key: `queue.${state}`,
              value: queue.counts[state] ?? 0,
              dimension: queue.name,
            });
          }
          metrics.push(
            {
              key: 'queue.connectionLatencyMs',
              value: queue.pingMs,
              dimension: queue.name,
            },
            {
              key: 'queue.oldestWaitingSeconds',
              value: queue.oldestWaitingSeconds,
              dimension: queue.name,
            },
          );
        }
        if (now.getTime() - this.lastExpensiveCollectionAt >= 15 * 60_000) {
          this.lastExpensiveCollectionAt = now.getTime();
          const storage = await safeSource('documentStorage', () =>
            this.documentStorageService.getDocumentStorage(),
          );
          if (database)
            metrics.push({ key: 'database.sizeBytes', value: database.size });
          if (storage) {
            metrics.push(
              { key: 'documentStorage.sizeBytes', value: storage.totalSize },
              {
                key: 'documentStorage.fileCount',
                value: storage.totalFileCount,
              },
            );
          }
        }
      }

      const validMetrics = metrics.filter((metric) =>
        Number.isFinite(metric.value),
      );
      validMetrics.push({
        key: 'telemetry.spool.overflow',
        value: this.spool.getStatus().overflowed ? 1 : 0,
      });
      await this.spool.drain<{ capturedAt: string; metrics: NumericMetric[] }>(
        'system',
        (batch) =>
          this.persistSample(new Date(batch.capturedAt), batch.metrics),
      );
      try {
        await this.persistSample(now, validMetrics);
      } catch (error) {
        await this.spool.write('system', {
          capturedAt: now.toISOString(),
          metrics: validMetrics,
        });
        throw error;
      }
      this.lastSampleAt = now;
      this.lastError = null;
      this.sampleCount += 1;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      global.log?.error?.('system telemetry collection failed', error);
    } finally {
      this.running = false;
    }
  }

  private async persistSample(
    now: Date,
    metrics: NumericMetric[],
  ): Promise<void> {
    const em = this.em.fork();
    await this.environment.ensure(em);
    const version = this.versionService.getVersion().version ?? null;
    await em.getConnection().execute(
      `insert into "system_telemetry_instance_item" (
        "handle", "environment_handle", "process_slot", "boot_id", "hostname", "app_version", "process_started_at",
        "last_sample_at", "collector_enabled", "status", "created_at", "updated_at"
      ) values (?, ?, ?, ?, ?, ?, ?, ?, true, 'active', now(), now())
      on conflict ("handle") do update set
        "hostname" = excluded."hostname",
        "app_version" = excluded."app_version",
        "process_started_at" = excluded."process_started_at",
        "last_sample_at" = excluded."last_sample_at",
        "collector_enabled" = true,
        "status" = 'active',
        "updated_at" = now()`,
      [
        this.instanceId,
        this.environment.currentId,
        SYSTEM_PROCESS_SLOT,
        this.bootId,
        os.hostname(),
        version,
        new Date(Date.now() - process.uptime() * 1000),
        now,
      ],
    );
    const bucketStart = floorDate(now, 10_000);
    for (const metric of metrics) {
      await em.getConnection().execute(
        `insert into "system_metric_bucket_item" (
          "instance_handle", "bucket_start", "resolution", "metric_key",
          "dimension_key", "sample_count", "minimum", "maximum", "sum",
          "last", "created_at"
        ) values (?, ?, '10s', ?, ?, 1, ?, ?, ?, ?, now())
        on conflict ("instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key")
        do update set "sample_count" = 1, "minimum" = excluded."minimum",
          "maximum" = excluded."maximum", "sum" = excluded."sum",
          "last" = excluded."last"`,
        [
          this.instanceId,
          bucketStart,
          metric.key,
          metric.dimension ?? '',
          metric.value,
          metric.value,
          metric.value,
          metric.value,
        ],
      );
    }
  }

  private async prepareInstance(): Promise<void> {
    const em = this.em.fork();
    await this.environment.ensure(em);
    await em.getConnection().execute(
      `update "system_telemetry_instance_item" set "status" = 'retired',
        "retired_at" = now(), "lifecycle_reason" = 'uncleanRestart', "updated_at" = now()
       where "environment_handle" = ? and "process_slot" = ? and "status" = 'active'`,
      [this.environment.currentId, SYSTEM_PROCESS_SLOT],
    );
    const version = this.versionService.getVersion().version ?? null;
    await em.getConnection().execute(
      `insert into "system_telemetry_instance_item" (
        "handle", "environment_handle", "process_slot", "boot_id", "hostname", "app_version",
        "process_started_at", "collector_enabled", "status", "created_at", "updated_at"
      ) values (?, ?, ?, ?, ?, ?, ?, true, 'active', now(), now())`,
      [
        this.instanceId,
        this.environment.currentId,
        SYSTEM_PROCESS_SLOT,
        this.bootId,
        os.hostname(),
        version,
        new Date(),
      ],
    );
  }

  private async markStopped(): Promise<void> {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    try {
      await this.em
        .fork()
        .getConnection()
        .execute(
          `update "system_telemetry_instance_item" set "status" = 'stopped',
          "stopped_at" = now(), "lifecycle_reason" = 'gracefulShutdown',
          "collector_enabled" = false, "updated_at" = now() where "handle" = ?`,
          [this.instanceId],
        );
    } catch (error) {
      global.log?.warn?.('telemetry instance shutdown state failed', error);
    }
  }

  private measureProcessCpuPercent(): number {
    const measuredAt = process.hrtime.bigint();
    const usage = process.cpuUsage(this.previousCpuUsage);
    const elapsedMicros =
      Number(measuredAt - this.previousCpuMeasuredAt) / 1000;
    this.previousCpuUsage = process.cpuUsage();
    this.previousCpuMeasuredAt = measuredAt;
    if (elapsedMicros <= 0) return 0;
    return (
      ((usage.user + usage.system) /
        elapsedMicros /
        Math.max(1, os.cpus().length)) *
      100
    );
  }

  private async collectDatabaseRuntime(): Promise<NumericMetric[]> {
    const startedAt = performance.now();
    const rows = (await this.em
      .fork()
      .getConnection()
      .execute(
        `select (select count(*) from pg_locks where not granted)::int as "waitingLocks",
         coalesce(sum("deadlocks"), 0)::bigint as "deadlocks",
         coalesce(sum("xact_rollback"), 0)::bigint as "rollbacks"
       from pg_stat_database where "datname" = current_database()`,
      )) as Array<{
      waitingLocks: number;
      deadlocks: number;
      rollbacks: number;
    }>;
    return [
      { key: 'database.probeLatencyMs', value: performance.now() - startedAt },
      {
        key: 'database.waitingLocks',
        value: Number(rows[0]?.waitingLocks ?? 0),
      },
      {
        key: 'database.deadlocksTotal',
        value: Number(rows[0]?.deadlocks ?? 0),
      },
      {
        key: 'database.rollbacksTotal',
        value: Number(rows[0]?.rollbacks ?? 0),
      },
    ];
  }
}

function percentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function sanitizeDimension(value: string): string {
  return value.replace(/[\r\n\0]/g, '').slice(0, 255);
}

function floorDate(date: Date, intervalMs: number): Date {
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

async function safeSource<T>(
  source: string,
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    global.log?.warn?.(`system telemetry source failed: ${source}`, error);
    return null;
  }
}

export const MONITORED_QUEUE_NAMES = [
  'emails',
  'email-inbox-sync',
  'imports',
  'teams',
  'webhooks',
  'calendar',
  'calendar-sync',
] as const;
