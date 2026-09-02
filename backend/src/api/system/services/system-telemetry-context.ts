import os from 'os';
import {
  SYSTEM_TELEMETRY_ENVIRONMENT_ID,
  SYSTEM_TELEMETRY_PROCESS_SLOT,
} from '../../../constants/project.constants';

function safeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export const SYSTEM_ENVIRONMENT_ID =
  safeIdentifier(SYSTEM_TELEMETRY_ENVIRONMENT_ID) ||
  `host:${safeIdentifier(os.hostname()) || 'unknown'}`;

export const SYSTEM_ENVIRONMENT_ID_IS_EXPLICIT =
  safeIdentifier(SYSTEM_TELEMETRY_ENVIRONMENT_ID).length > 0;

export const SYSTEM_PROCESS_SLOT =
  safeIdentifier(SYSTEM_TELEMETRY_PROCESS_SLOT) || 'backend:0';

export function telemetryEnvironmentKind():
  'production' | 'test' | 'development' {
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}
