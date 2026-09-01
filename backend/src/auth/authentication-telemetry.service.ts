import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SYSTEM_TELEMETRY_ENABLED } from '../constants/project.constants';
import {
  SYSTEM_ENVIRONMENT_ID,
  telemetryEnvironmentKind,
} from '../api/system/services/system-telemetry-context';
import os from 'os';

export type AuthenticationTelemetryProvider =
  'local' | 'passkey' | 'azure' | 'google' | 'unknown';

@Injectable()
export class AuthenticationTelemetryService {
  constructor(private readonly em: EntityManager) {}

  async record(
    eventType: 'loginSuccess' | 'loginFailure' | 'logout',
    provider: AuthenticationTelemetryProvider,
    personHandle?: number | null,
  ): Promise<void> {
    if (!SYSTEM_TELEMETRY_ENABLED) return;
    try {
      const connection = this.em.fork().getConnection();
      await connection.execute(
        `insert into "system_telemetry_environment_item" ("handle", "name", "kind", "is_archived", "first_seen_at", "last_seen_at")
         values (?, ?, ?, false, now(), now()) on conflict ("handle") do update set "last_seen_at" = now()`,
        [SYSTEM_ENVIRONMENT_ID, os.hostname(), telemetryEnvironmentKind()],
      );
      await connection.execute(
        `insert into "authentication_event_item" (
          "environment_handle", "person_handle", "event_type", "provider", "occurred_at"
        ) values (?, ?, ?, ?, now())`,
        [SYSTEM_ENVIRONMENT_ID, personHandle ?? null, eventType, provider],
      );
    } catch (error) {
      global.log?.error?.('authentication telemetry write failed', error);
    }
  }
}
