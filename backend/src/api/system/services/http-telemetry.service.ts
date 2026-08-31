import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { NextFunction, Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { appendServerTiming } from '../../common/performance-timing.interceptor';
import { SYSTEM_TELEMETRY_ENABLED } from '../../../constants/project.constants';
import { TelemetrySpoolService } from './telemetry-spool.service';

export const HTTP_DURATION_BUCKETS_MS = [
  25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
] as const;

type AuthKind = 'session' | 'apiToken' | 'anonymous' | 'system';

export type TelemetryRequestContext = {
  authKind?: AuthKind;
  apiTokenHandle?: number;
};

type TelemetryRequest = Request & {
  telemetry?: TelemetryRequestContext;
  user?: Express.User & {
    handle?: number;
    _impersonator?: { handle?: number };
  };
};

type HttpBucket = {
  bucketStart: Date;
  attributionKey: string;
  personHandle: number | null;
  apiTokenHandle: number | null;
  authKind: AuthKind;
  routeGroup: string;
  requestCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  requestBytes: number;
  responseBytes: number;
  durationSumMs: number;
  durationMaxMs: number;
  durationHistogram: number[];
  impersonatedCount: number;
};

@Injectable()
export class HttpTelemetryService
  implements OnModuleInit, OnApplicationShutdown
{
  private buckets = new Map<string, HttpBucket>();
  private flushTimer?: NodeJS.Timeout;
  private flushing = false;
  private lastFlushAt: Date | null = null;
  private lastFlushError: string | null = null;

  constructor(
    private readonly em: EntityManager,
    private readonly spool: TelemetrySpoolService,
  ) {}

  onModuleInit(): void {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    this.flushTimer = setInterval(() => void this.flush(), 10_000);
    this.flushTimer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }

  record(
    request: TelemetryRequest,
    statusCode: number,
    durationMs: number,
    requestBytes: number,
    responseBytes: number,
  ): void {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    const impersonatorHandle = request.user?._impersonator?.handle;
    const effectiveHandle = request.user?.handle;
    const personHandle =
      typeof impersonatorHandle === 'number'
        ? impersonatorHandle
        : typeof effectiveHandle === 'number'
          ? effectiveHandle
          : null;
    const apiTokenHandle = request.telemetry?.apiTokenHandle ?? null;
    const authKind: AuthKind =
      request.telemetry?.authKind ??
      (personHandle == null ? 'anonymous' : 'session');
    const attributionKey =
      apiTokenHandle != null
        ? `token:${apiTokenHandle}`
        : personHandle != null
          ? `person:${personHandle}`
          : authKind;
    const bucketStart = floorDate(new Date(), 60_000);
    const routeGroup = resolveRouteGroup(request.path || request.url || '');
    const key = [
      bucketStart.toISOString(),
      attributionKey,
      authKind,
      routeGroup,
    ].join('|');
    const bucket =
      this.buckets.get(key) ??
      createBucket({
        bucketStart,
        attributionKey,
        personHandle,
        apiTokenHandle,
        authKind,
        routeGroup,
      });

    bucket.requestCount += 1;
    if (statusCode >= 400 && statusCode < 500) bucket.clientErrorCount += 1;
    if (statusCode >= 500) bucket.serverErrorCount += 1;
    bucket.requestBytes += Math.max(0, requestBytes);
    bucket.responseBytes += Math.max(0, responseBytes);
    bucket.durationSumMs += Math.max(0, durationMs);
    bucket.durationMaxMs = Math.max(bucket.durationMaxMs, durationMs);
    bucket.durationHistogram[resolveDurationBucket(durationMs)] += 1;
    if (typeof impersonatorHandle === 'number') bucket.impersonatedCount += 1;
    this.buckets.set(key, bucket);
  }

  getStatus() {
    return {
      pendingBucketCount: this.buckets.size,
      lastFlushAt: this.lastFlushAt?.toISOString() ?? null,
      lastFlushError: this.lastFlushError,
      spool: this.spool.getStatus(),
    };
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buckets.size === 0) return;
    this.flushing = true;
    const pending = this.buckets;
    this.buckets = new Map();
    try {
      await this.spool.drain<HttpBucket[]>('http', (buckets) =>
        this.persistBuckets(buckets),
      );
      await this.persistBuckets([...pending.values()]);
      this.lastFlushAt = new Date();
      this.lastFlushError = null;
    } catch (error) {
      this.lastFlushError =
        error instanceof Error ? error.message : String(error);
      await this.spool.write('http', [...pending.values()]);
      global.log?.error?.('system telemetry HTTP flush failed', error);
    } finally {
      this.flushing = false;
    }
  }

  private async persistBuckets(buckets: HttpBucket[]): Promise<void> {
    const em = this.em.fork();
    await em.transactional(async (transaction) => {
      for (const bucket of buckets) {
        await transaction
          .getConnection()
          .execute(buildHttpBucketUpsertSql(), [
            new Date(bucket.bucketStart),
            bucket.attributionKey,
            bucket.personHandle,
            bucket.apiTokenHandle,
            bucket.authKind,
            bucket.routeGroup,
            bucket.requestCount,
            bucket.clientErrorCount,
            bucket.serverErrorCount,
            bucket.requestBytes,
            bucket.responseBytes,
            bucket.durationSumMs,
            bucket.durationMaxMs,
            JSON.stringify(bucket.durationHistogram),
            bucket.impersonatedCount,
          ]);
      }
    });
  }
}

export function createHttpTelemetryMiddleware(service: HttpTelemetryService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = performance.now();
    const declaredRequestBytes = parseContentLength(
      request.headers['content-length'],
    );
    let responseBytes = 0;
    let finalized = false;
    const originalWrite = response.write.bind(response);
    const originalEnd = response.end.bind(response);

    response.write = ((chunk: unknown, ...args: unknown[]) => {
      responseBytes += byteLength(chunk);
      return originalWrite(chunk as never, ...(args as never[]));
    }) as Response['write'];

    response.end = ((chunk?: unknown, ...args: unknown[]) => {
      responseBytes += byteLength(chunk);
      if (!response.headersSent) {
        appendServerTiming(
          response,
          `total;dur=${(performance.now() - startedAt).toFixed(1)}`,
        );
      }
      return originalEnd(chunk as never, ...(args as never[]));
    }) as Response['end'];

    const finalize = (statusCode = response.statusCode) => {
      if (finalized) return;
      finalized = true;
      service.record(
        request as TelemetryRequest,
        statusCode,
        performance.now() - startedAt,
        declaredRequestBytes,
        responseBytes,
      );
    };
    response.once('finish', finalize);
    response.once('close', () =>
      finalize(response.writableFinished ? response.statusCode : 499),
    );
    next();
  };
}

export function resolveRouteGroup(path: string): string {
  const normalized = path.split('?', 1)[0].replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  const candidate = parts[0] === 'api' ? parts[1] : parts[0];
  const allowed = new Set([
    'ai',
    'auth',
    'calendar',
    'current',
    'document',
    'generic',
    'github',
    'inbox',
    'mail',
    'script',
    'system',
    'teams',
    'template',
    'webhook',
  ]);
  return candidate && allowed.has(candidate) ? candidate : 'other';
}

function createBucket(
  input: Pick<
    HttpBucket,
    | 'bucketStart'
    | 'attributionKey'
    | 'personHandle'
    | 'apiTokenHandle'
    | 'authKind'
    | 'routeGroup'
  >,
): HttpBucket {
  return {
    ...input,
    requestCount: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    requestBytes: 0,
    responseBytes: 0,
    durationSumMs: 0,
    durationMaxMs: 0,
    durationHistogram: Array.from({ length: 10 }, () => 0),
    impersonatedCount: 0,
  };
}

function resolveDurationBucket(durationMs: number): number {
  const index = HTTP_DURATION_BUCKETS_MS.findIndex(
    (limit) => durationMs <= limit,
  );
  return index === -1 ? HTTP_DURATION_BUCKETS_MS.length : index;
}

function floorDate(date: Date, intervalMs: number): Date {
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

function parseContentLength(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function byteLength(value: unknown): number {
  if (value == null) return 0;
  if (Buffer.isBuffer(value)) return value.length;
  if (value instanceof Uint8Array) return value.byteLength;
  return typeof value === 'string' ? Buffer.byteLength(value) : 0;
}

function buildHttpBucketUpsertSql(): string {
  const histogram = Array.from(
    { length: 10 },
    (_, index) =>
      `coalesce(("http_metric_bucket_item"."duration_histogram"->>${index})::int, 0) + coalesce((excluded."duration_histogram"->>${index})::int, 0)`,
  ).join(', ');
  return `insert into "http_metric_bucket_item" (
      "bucket_start", "resolution", "attribution_key", "person_handle",
      "api_token_handle", "auth_kind", "route_group", "request_count",
      "client_error_count", "server_error_count", "request_bytes",
      "response_bytes", "duration_sum_ms", "duration_max_ms",
      "duration_histogram", "impersonated_count", "created_at"
    ) values (?, '1m', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, now())
    on conflict ("bucket_start", "resolution", "attribution_key", "route_group", "auth_kind")
    do update set
      "request_count" = "http_metric_bucket_item"."request_count" + excluded."request_count",
      "client_error_count" = "http_metric_bucket_item"."client_error_count" + excluded."client_error_count",
      "server_error_count" = "http_metric_bucket_item"."server_error_count" + excluded."server_error_count",
      "request_bytes" = "http_metric_bucket_item"."request_bytes" + excluded."request_bytes",
      "response_bytes" = "http_metric_bucket_item"."response_bytes" + excluded."response_bytes",
      "duration_sum_ms" = "http_metric_bucket_item"."duration_sum_ms" + excluded."duration_sum_ms",
      "duration_max_ms" = greatest("http_metric_bucket_item"."duration_max_ms", excluded."duration_max_ms"),
      "duration_histogram" = jsonb_build_array(${histogram}),
      "impersonated_count" = "http_metric_bucket_item"."impersonated_count" + excluded."impersonated_count"`;
}
