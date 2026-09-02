import { BadRequestException } from '@nestjs/common';
import type { MonitoringRangeQueryDto } from '../dto/monitoring-query.dto';

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

export type MonitoringRange = { from: Date; to: Date };

export function resolveRange(query: MonitoringRangeQueryDto): MonitoringRange {
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

export function serializeRange(range: MonitoringRange) {
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

export function latestCapturedAt(
  rows: Array<Record<string, unknown>>,
): string | null {
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

export function chooseMetricResolution(
  range: MonitoringRange,
): '10s' | '1m' | '15m' | '1h' {
  const duration = range.to.getTime() - range.from.getTime();
  if (duration <= 2 * 60 * 60 * 1000) return '10s';
  if (duration <= 48 * 60 * 60 * 1000) return '1m';
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '15m';
  return '1h';
}

export function metricResolutionRank(
  resolution: '10s' | '1m' | '15m' | '1h',
): number {
  return { '10s': 0, '1m': 1, '15m': 2, '1h': 3 }[resolution];
}

export function chooseHttpResolution(
  range: MonitoringRange,
): '1m' | '15m' | '1h' {
  const duration = range.to.getTime() - range.from.getTime();
  if (duration <= 7 * 24 * 60 * 60 * 1000) return '1m';
  if (duration <= 30 * 24 * 60 * 60 * 1000) return '15m';
  return '1h';
}

export function userSortSql(sort: string): string {
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

export function aiGroupSql(groupBy: string): string {
  if (groupBy === 'model') return `coalesce("model", 'unknown')`;
  if (groupBy === 'person') return `coalesce("person_handle"::text, 'system')`;
  if (groupBy === 'day') return `date_trunc('day', "occurred_at")`;
  return `coalesce("provider", 'unknown')`;
}

export function httpGroupSql(groupBy: string): string {
  if (groupBy === 'auth') return `"auth_kind"`;
  if (groupBy === 'operation') return `"operation"`;
  if (groupBy === 'resource')
    return `coalesce(nullif("resource_key", ''), 'unattributed')`;
  return `"route_group"`;
}

export function normalizeNumericRecord(record: Record<string, unknown>) {
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

export function toDimension(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

export function resolveHealth(
  metrics: Record<string, number>,
  incidents: Record<string, unknown> | undefined,
): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (Number(incidents?.criticalCount ?? 0) > 0) return 'critical';
  if (Number(incidents?.openCount ?? 0) > 0) return 'warning';
  return Object.keys(metrics).length > 0 ? 'healthy' : 'unknown';
}

export function histogramSumSql(): string {
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

export function percentileFromHistogram(
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
