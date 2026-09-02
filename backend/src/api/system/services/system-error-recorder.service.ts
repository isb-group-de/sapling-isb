import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { createHash } from 'crypto';
import { VersionService } from './version.service';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';
import { SystemTelemetryCollectorService } from './system-telemetry-collector.service';
import { getSystemRequestContext } from './system-request-context';

export type SystemErrorInput = {
  source:
    'backend' | 'frontend' | 'job' | 'integration' | 'process' | 'telemetry';
  operation: string;
  error: unknown;
  requestId?: string | null;
  correlationId?: string | null;
  occurredAt?: Date;
};

export const RECORD_SYSTEM_ERROR_SQL = `with upserted_group as (
  insert into "system_error_group_item" (
    "environment_handle", "fingerprint", "source", "operation", "status",
    "occurrence_count", "latest_release", "first_seen_at", "last_seen_at"
  ) values (?, ?, ?, ?, 'open', 1, ?, ?, ?)
  on conflict ("environment_handle", "fingerprint") do update set
    "status" = 'open',
    "occurrence_count" = "system_error_group_item"."occurrence_count" + 1,
    "latest_release" = excluded."latest_release",
    "last_seen_at" = excluded."last_seen_at"
  returning "handle"
)
insert into "system_error_occurrence_item" (
  "group_handle", "environment_handle", "instance_handle", "operation", "source",
  "error_class", "error_code", "message", "stack", "request_id", "correlation_id",
  "release", "occurred_at"
)
select upserted_group."handle", ?,
  (select "handle" from "system_telemetry_instance_item" where "handle" = ?),
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
from upserted_group`;

@Injectable()
export class SystemErrorRecorderService {
  constructor(
    private readonly em: EntityManager,
    private readonly environment: SystemTelemetryEnvironmentService,
    private readonly version: VersionService,
    private readonly collector: SystemTelemetryCollectorService,
  ) {}

  async record(input: SystemErrorInput): Promise<void> {
    const normalized = normalizeError(input.error);
    const operation = sanitizeOperation(input.operation);
    const fingerprint = createHash('sha256')
      .update(
        [
          input.source,
          operation,
          normalized.errorClass,
          normalized.errorCode,
          normalized.message,
          normalized.stackFingerprint,
        ].join('|'),
      )
      .digest('hex');
    const context = getSystemRequestContext();
    const release = this.version.getVersion().version ?? null;
    const occurredAt = input.occurredAt ?? new Date();
    const em = this.em.fork();
    try {
      await this.environment.ensure(em);
      await em
        .getConnection()
        .execute(RECORD_SYSTEM_ERROR_SQL, [
          this.environment.currentId,
          fingerprint,
          input.source,
          operation,
          release,
          occurredAt,
          occurredAt,
          this.environment.currentId,
          this.collector.instanceId,
          operation,
          input.source,
          normalized.errorClass,
          normalized.errorCode,
          normalized.message,
          normalized.stack,
          sanitizeId(input.requestId ?? context?.requestId),
          sanitizeId(input.correlationId ?? context?.correlationId),
          release,
          occurredAt,
        ]);
    } catch (recordingError) {
      global.log?.warn?.('system error recording failed', recordingError);
    }
  }
}

function normalizeError(error: unknown) {
  const record = isRecord(error) ? error : {};
  const errorClass =
    error instanceof Error ? error.name : readString(record.name) || 'Error';
  const errorCode = readString(record.code)?.slice(0, 64) || null;
  const message = redact(
    readString(record.message) || stringifyPrimitive(error),
  ).slice(0, 500);
  const stack = error instanceof Error ? sanitizeStack(error.stack) : null;
  const stackFingerprint = (stack || '').split('\n').slice(0, 6).join('\n');
  return {
    errorClass: redact(errorClass).slice(0, 128),
    errorCode,
    message,
    stack,
    stackFingerprint,
  };
}

function sanitizeStack(stack: string | undefined): string | null {
  if (!stack) return null;
  return redact(stack)
    .replace(/[A-Za-z]:\\[^\s)]+|\/(?:[^\s/)]+\/)+[^\s)]+/g, '[path]')
    .split('\n')
    .slice(0, 30)
    .join('\n')
    .slice(0, 8000);
}

function redact(value: string): string {
  return value
    .replace(/(?:bearer\s+)?[a-z0-9_-]{24,}/gi, '[redacted]')
    .replace(/\b\d{4,}\b/g, '[id]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]');
}

function sanitizeOperation(value: string): string {
  return (
    value
      .replace(/[\r\n\0]/g, '')
      .replace(/\d+/g, ':id')
      .slice(0, 160) || 'unknown'
  );
}

function sanitizeId(value: string | null | undefined): string | null {
  return value && /^[a-zA-Z0-9._:-]{8,64}$/.test(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringifyPrimitive(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return 'Unknown error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
