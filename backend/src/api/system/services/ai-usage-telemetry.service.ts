import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SYSTEM_TELEMETRY_ENABLED } from '../../../constants/project.constants';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';
import { AI_USAGE_BACKFILL_SQL } from './ai-usage-backfill.sql';

export type AiUsageTelemetryInput = {
  sourceKey: string;
  personHandle?: number | null;
  operation: string;
  executionType?: string;
  provider?: string | null;
  model?: string | null;
  status: string;
  durationMs?: number | null;
  usagePayload?: Record<string, unknown> | null;
  occurredAt?: Date;
};

@Injectable()
export class AiUsageTelemetryService
  implements OnModuleInit, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly em: EntityManager,
    private readonly environment: SystemTelemetryEnvironmentService,
  ) {}

  onModuleInit(): void {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    void this.backfillAgentRuns();
    this.timer = setInterval(() => void this.backfillAgentRuns(), 30_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async record(input: AiUsageTelemetryInput): Promise<void> {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    const usage = normalizeUsage(input.usagePayload);
    try {
      const em = this.em.fork();
      await this.environment.ensure(em);
      await em.getConnection().execute(
        `insert into "ai_usage_event_item" (
        "environment_handle", "source_key", "person_handle", "operation", "execution_type",
        "provider", "model", "status", "duration_ms", "input_tokens",
        "output_tokens", "total_tokens", "usage_reported", "occurred_at", "created_at"
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
      on conflict ("source_key") do nothing`,
        [
          this.environment.currentId,
          input.sourceKey,
          input.personHandle ?? null,
          input.operation,
          input.executionType ?? 'interactive',
          input.provider ?? null,
          input.model ?? null,
          input.status,
          input.durationMs ?? null,
          usage.inputTokens,
          usage.outputTokens,
          usage.totalTokens,
          usage.reported,
          input.occurredAt ?? new Date(),
        ],
      );
    } catch (error) {
      global.log?.error?.('AI usage telemetry write failed', error);
    }
  }

  async backfillAgentRuns(): Promise<void> {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    try {
      const em = this.em.fork();
      await this.environment.ensure(em);
      await em
        .getConnection()
        .execute(AI_USAGE_BACKFILL_SQL, [this.environment.currentId]);
    } catch (error) {
      global.log?.error?.('AI usage telemetry backfill failed', error);
    }
  }
}

export function normalizeUsage(payload?: Record<string, unknown> | null) {
  const inputTokens = readUsageNumber(payload, [
    'inputTokens',
    'input_tokens',
    'promptTokens',
    'prompt_tokens',
    'promptTokenCount',
  ]);
  const outputTokens = readUsageNumber(payload, [
    'outputTokens',
    'output_tokens',
    'completionTokens',
    'completion_tokens',
    'candidatesTokenCount',
  ]);
  const totalTokens =
    readUsageNumber(payload, [
      'totalTokens',
      'total_tokens',
      'totalTokenCount',
    ]) ??
    (inputTokens != null || outputTokens != null
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : null);
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reported:
      inputTokens != null || outputTokens != null || totalTokens != null,
  };
}

function readUsageNumber(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value))
      return Math.max(0, Math.round(value));
  }
  return null;
}
