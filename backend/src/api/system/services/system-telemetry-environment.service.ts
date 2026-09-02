import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import os from 'os';
import {
  SYSTEM_ENVIRONMENT_ID,
  SYSTEM_ENVIRONMENT_ID_IS_EXPLICIT,
  telemetryEnvironmentKind,
} from './system-telemetry-context';

@Injectable()
export class SystemTelemetryEnvironmentService {
  constructor(private readonly em: EntityManager) {}

  get currentId(): string {
    return SYSTEM_ENVIRONMENT_ID;
  }

  get currentKind(): 'production' | 'test' | 'development' {
    return telemetryEnvironmentKind();
  }

  get isExplicitlyConfigured(): boolean {
    return SYSTEM_ENVIRONMENT_ID_IS_EXPLICIT;
  }

  async ensureCurrent(): Promise<void> {
    await this.ensure(this.em.fork());
  }

  async ensure(em: EntityManager): Promise<void> {
    await em.getConnection().execute(
      `insert into "system_telemetry_environment_item" (
        "handle", "name", "kind", "is_archived", "first_seen_at", "last_seen_at"
      ) values (?, ?, ?, false, now(), now())
      on conflict ("handle") do update set "name" = excluded."name",
        "kind" = excluded."kind", "last_seen_at" = now(), "is_archived" = false`,
      [SYSTEM_ENVIRONMENT_ID, displayName(), telemetryEnvironmentKind()],
    );
  }
}

function displayName(): string {
  const configured = process.env.SYSTEM_TELEMETRY_ENVIRONMENT_NAME?.trim();
  return (configured || os.hostname()).slice(0, 128);
}
