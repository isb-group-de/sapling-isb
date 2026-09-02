import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SystemCheckService } from './system-check.service';
import { SystemTelemetryCollectorService } from './system-telemetry-collector.service';
import { SystemTelemetryEnvironmentService } from './system-telemetry-environment.service';

export const SAFE_REMEDIATION_ACTIONS = [
  'telemetry.recover',
  'checks.retry',
] as const;
export type SafeRemediationAction = (typeof SAFE_REMEDIATION_ACTIONS)[number];

@Injectable()
export class SystemRemediationService {
  constructor(
    private readonly em: EntityManager,
    private readonly environment: SystemTelemetryEnvironmentService,
    private readonly collector: SystemTelemetryCollectorService,
    private readonly checks: SystemCheckService,
  ) {}

  async execute(input: {
    actionKey: string;
    incidentHandle?: number | null;
    mode: 'automatic' | 'approved';
    approvedByHandle?: number | null;
  }) {
    if (
      !SAFE_REMEDIATION_ACTIONS.includes(
        input.actionKey as SafeRemediationAction,
      )
    ) {
      throw new BadRequestException('system.monitoringRemediationNotAllowed');
    }
    const idempotencyKey = `${this.environment.currentId}:${input.incidentHandle ?? 'manual'}:${input.actionKey}`;
    const em = this.em.fork();
    await this.environment.ensure(em);
    const existing = (await em
      .getConnection()
      .execute(
        `select * from "system_remediation_execution_item" where "idempotency_key" = ?`,
        [idempotencyKey],
      )) as Array<Record<string, unknown>>;
    if (existing[0]) return existing[0];

    const rows = (await em.getConnection().execute(
      `insert into "system_remediation_execution_item" (
        "environment_handle", "incident_handle", "action_key", "mode", "state", "attempt",
        "idempotency_key", "approved_by_handle", "started_at"
      ) values (?, ?, ?, ?, 'running', 1, ?, ?, now()) returning "handle"`,
      [
        this.environment.currentId,
        input.incidentHandle ?? null,
        input.actionKey,
        input.mode,
        idempotencyKey,
        input.approvedByHandle ?? null,
      ],
    )) as Array<{ handle: number }>;
    try {
      const evidence =
        input.actionKey === 'telemetry.recover'
          ? await this.recoverTelemetry()
          : { verification: await this.verifyThreeTimes() };
      await em
        .getConnection()
        .execute(
          `update "system_remediation_execution_item" set "state" = 'succeeded', "evidence" = ?, "completed_at" = now() where "handle" = ?`,
          [JSON.stringify(evidence), rows[0]?.handle],
        );
    } catch (error) {
      await em
        .getConnection()
        .execute(
          `update "system_remediation_execution_item" set "state" = 'failed', "evidence" = ?, "completed_at" = now() where "handle" = ?`,
          [
            JSON.stringify({
              error: error instanceof Error ? error.name : 'Error',
            }),
            rows[0]?.handle,
          ],
        );
    }
    return (
      (await em
        .getConnection()
        .execute(
          `select * from "system_remediation_execution_item" where "handle" = ?`,
          [rows[0]?.handle],
        )) as Array<Record<string, unknown>>
    )[0];
  }

  private async recoverTelemetry() {
    await this.collector.collect();
    return {
      collector: this.collector.getStatus(),
      verification: await this.verifyThreeTimes('telemetry.collector'),
    };
  }

  private async verifyThreeTimes(checkKey?: string) {
    const verification: Array<{
      evaluation: number;
      checks: Awaited<ReturnType<SystemCheckService['runAll']>>;
    }> = [];
    for (let evaluation = 1; evaluation <= 3; evaluation += 1) {
      const checks = await this.checks.runAll();
      const relevant = checkKey
        ? checks.filter((check) => check.checkKey === checkKey)
        : checks;
      verification.push({ evaluation, checks: relevant });
      if (
        relevant.length === 0 ||
        relevant.some(
          (check) => check.status === 'warning' || check.status === 'critical',
        ) ||
        !relevant.some((check) => check.status === 'healthy')
      ) {
        throw new Error('remediation verification failed');
      }
    }
    return verification;
  }
}
