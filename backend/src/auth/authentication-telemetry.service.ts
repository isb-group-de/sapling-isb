import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SYSTEM_TELEMETRY_ENABLED } from '../constants/project.constants';

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
      await this.em
        .fork()
        .getConnection()
        .execute(
          `insert into "authentication_event_item" (
          "person_handle", "event_type", "provider", "occurred_at"
        ) values (?, ?, ?, now())`,
          [personHandle ?? null, eventType, provider],
        );
    } catch (error) {
      global.log?.error?.('authentication telemetry write failed', error);
    }
  }
}
