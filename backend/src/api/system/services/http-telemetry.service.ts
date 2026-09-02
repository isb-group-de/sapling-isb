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
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';
import { ENTITY_REGISTRY } from '../../../entity/global/entity.registry';

export const HTTP_DURATION_BUCKETS_MS = [
  25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
] as const;

type AuthKind = 'session' | 'apiToken' | 'anonymous' | 'system';
export type HttpRequestKind = 'standard' | 'stream';

const ROUTE_GROUPS = new Set([
  'ai',
  'auth',
  'calendar',
  'current',
  'customer-360',
  'document',
  'form-config',
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
const REGISTERED_ENTITY_HANDLES = new Set(
  ENTITY_REGISTRY.map((entry) => entry.name),
);

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
  operation: string;
  requestKind: HttpRequestKind;
  resourceKey: string;
  requestCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  abortedCount: number;
  timeoutCount: number;
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
  private activeRequests = 0;
  private activeStreams = 0;

  constructor(
    private readonly em: EntityManager,
    private readonly spool: TelemetrySpoolService,
    private readonly environment: SystemTelemetryEnvironmentService,
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
    requestKind: HttpRequestKind = resolveRequestKind(request),
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
    const operation = resolveOperation(request);
    const resourceKey = resolveResourceKey(request);
    const key = [
      bucketStart.toISOString(),
      attributionKey,
      authKind,
      routeGroup,
      operation,
      requestKind,
      resourceKey,
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
        operation,
        requestKind,
        resourceKey,
      });

    bucket.requestCount += 1;
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 499)
      bucket.clientErrorCount += 1;
    if (statusCode >= 500) bucket.serverErrorCount += 1;
    if (statusCode === 499) bucket.abortedCount += 1;
    if (statusCode === 408 || statusCode === 504) bucket.timeoutCount += 1;
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
      activeRequests: this.activeRequests,
      activeStreams: this.activeStreams,
      spool: this.spool.getStatus(),
    };
  }

  requestStarted(kind: HttpRequestKind = 'standard'): void {
    if (kind === 'stream') this.activeStreams += 1;
    else this.activeRequests += 1;
  }

  requestFinished(kind: HttpRequestKind = 'standard'): void {
    if (kind === 'stream')
      this.activeStreams = Math.max(0, this.activeStreams - 1);
    else this.activeRequests = Math.max(0, this.activeRequests - 1);
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
    if (buckets.length === 0) return;
    const em = this.em.fork();
    await this.environment.ensure(em);
    await em.transactional((transaction) =>
      transaction
        .getConnection()
        .execute(buildHttpBucketUpsertSql(), [
          JSON.stringify(buckets),
          this.environment.currentId,
        ]),
    );
  }
}

export function createHttpTelemetryMiddleware(service: HttpTelemetryService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedKind = resolveRequestKind(request);
    service.requestStarted(startedKind);
    const startedAt = performance.now();
    const declaredRequestBytes = parseContentLength(
      request.headers['content-length'],
    );
    let responseBytes = 0;
    let finalized = false;
    const originalWrite = response.write.bind(response) as unknown as (
      ...args: unknown[]
    ) => unknown;
    const originalEnd = response.end.bind(response) as unknown as (
      ...args: unknown[]
    ) => unknown;

    response.write = ((chunk: unknown, ...args: unknown[]) => {
      responseBytes += byteLength(chunk);
      return originalWrite(chunk, ...args) === true;
    }) as Response['write'];

    response.end = ((chunk?: unknown, ...args: unknown[]) => {
      responseBytes += byteLength(chunk);
      if (!response.headersSent) {
        appendServerTiming(
          response,
          `total;dur=${(performance.now() - startedAt).toFixed(1)}`,
        );
      }
      originalEnd(chunk, ...args);
      return response;
    }) as Response['end'];

    const finalize = (statusCode = response.statusCode) => {
      if (finalized) return;
      finalized = true;
      service.requestFinished(startedKind);
      const requestKind = resolveRequestKind(request, response);
      service.record(
        request as TelemetryRequest,
        statusCode,
        performance.now() - startedAt,
        declaredRequestBytes,
        responseBytes,
        requestKind,
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
  return candidate && ROUTE_GROUPS.has(candidate) ? candidate : 'other';
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
    | 'operation'
    | 'requestKind'
    | 'resourceKey'
  >,
): HttpBucket {
  return {
    ...input,
    requestCount: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    abortedCount: 0,
    timeoutCount: 0,
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

export function buildHttpBucketUpsertSql(): string {
  const histogram = Array.from(
    { length: 10 },
    (_, index) =>
      `coalesce(("http_metric_bucket_item"."duration_histogram"->>${index})::int, 0) + coalesce((excluded."duration_histogram"->>${index})::int, 0)`,
  ).join(', ');
  return `with buckets as (
      select * from jsonb_to_recordset(cast(? as jsonb)) as bucket(
        "bucketStart" timestamptz, "attributionKey" varchar, "personHandle" int,
        "apiTokenHandle" int, "authKind" varchar, "routeGroup" varchar,
        "operation" varchar, "requestKind" varchar, "resourceKey" varchar,
        "requestCount" int, "clientErrorCount" int, "serverErrorCount" int,
        "abortedCount" int, "timeoutCount" int, "requestBytes" bigint,
        "responseBytes" bigint, "durationSumMs" float8, "durationMaxMs" float8,
        "durationHistogram" jsonb, "impersonatedCount" int
      )
    )
    insert into "http_metric_bucket_item" (
      "environment_handle", "bucket_start", "resolution", "attribution_key", "person_handle",
      "api_token_handle", "auth_kind", "route_group", "operation", "request_kind", "resource_key", "request_count",
      "client_error_count", "server_error_count", "aborted_count", "timeout_count", "request_bytes",
      "response_bytes", "duration_sum_ms", "duration_max_ms",
      "duration_histogram", "impersonated_count", "created_at"
    ) select ?, "bucketStart", '1m', "attributionKey", "personHandle", "apiTokenHandle",
      "authKind", "routeGroup", "operation", "requestKind", "resourceKey", "requestCount",
      "clientErrorCount", "serverErrorCount", "abortedCount", "timeoutCount", "requestBytes",
      "responseBytes", "durationSumMs", "durationMaxMs", "durationHistogram", "impersonatedCount", now()
    from buckets
    on conflict ("environment_handle", "bucket_start", "resolution", "attribution_key", "route_group", "operation", "request_kind", "resource_key", "auth_kind")
    do update set
      "request_count" = "http_metric_bucket_item"."request_count" + excluded."request_count",
      "client_error_count" = "http_metric_bucket_item"."client_error_count" + excluded."client_error_count",
      "server_error_count" = "http_metric_bucket_item"."server_error_count" + excluded."server_error_count",
      "aborted_count" = "http_metric_bucket_item"."aborted_count" + excluded."aborted_count",
      "timeout_count" = "http_metric_bucket_item"."timeout_count" + excluded."timeout_count",
      "request_bytes" = "http_metric_bucket_item"."request_bytes" + excluded."request_bytes",
      "response_bytes" = "http_metric_bucket_item"."response_bytes" + excluded."response_bytes",
      "duration_sum_ms" = "http_metric_bucket_item"."duration_sum_ms" + excluded."duration_sum_ms",
      "duration_max_ms" = greatest("http_metric_bucket_item"."duration_max_ms", excluded."duration_max_ms"),
      "duration_histogram" = jsonb_build_array(${histogram}),
      "impersonated_count" = "http_metric_bucket_item"."impersonated_count" + excluded."impersonated_count"`;
}

export function resolveRequestKind(
  request: Request,
  response?: Response,
): HttpRequestKind {
  const operation = resolveOperation(request);
  if (
    operation === 'GET /api/current/openTaskCountEvents' ||
    operation === 'POST /api/ai/chat/stream'
  )
    return 'stream';
  const contentType = response?.getHeader?.('content-type');
  const serialized = Array.isArray(contentType)
    ? contentType.join(';')
    : String(contentType ?? '');
  return /(?:text\/event-stream|application\/x-ndjson)/i.test(serialized)
    ? 'stream'
    : 'standard';
}

export function resolveResourceKey(request: Request): string {
  const raw = (request.params as Record<string, unknown> | undefined)
    ?.entityHandle;
  return typeof raw === 'string' && REGISTERED_ENTITY_HANDLES.has(raw)
    ? raw
    : '';
}

function resolveOperation(request: Request): string {
  const routePath = (request.route as { path?: unknown } | undefined)?.path;
  const path =
    typeof routePath === 'string'
      ? routePath
      : (request.path || request.url || 'unknown')
          .split('?', 1)[0]
          .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
          .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,36}(?=\/|$)/gi, '/:id');
  const base = request.baseUrl || '';
  return `${(request.method || 'UNKNOWN').toUpperCase()} ${base}/${path}`
    .replace(/\/+/g, '/')
    .replace(/[\r\n\0]/g, '')
    .slice(0, 192);
}
