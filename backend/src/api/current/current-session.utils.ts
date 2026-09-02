import type { SessionStoreItem } from '../../entity/SessionStoreItem';

export interface CurrentSessionDto {
  id: string;
  isCurrent: boolean;
  deviceLabel: string;
  createdAt: Date | null;
  lastActivityAt: Date | null;
  expiresAt: Date;
}

interface StoredSessionPayload {
  passport?: {
    user?: { handle?: number | string; impersonatedHandle?: number | string };
  };
}

export function mapCurrentSession(
  record: SessionStoreItem,
  currentSessionId?: string | null,
): CurrentSessionDto {
  return {
    id: maskSessionId(record.handle),
    isCurrent: Boolean(currentSessionId && record.handle === currentSessionId),
    deviceLabel: 'Browser-Sitzung',
    createdAt: record.createdAt ?? null,
    lastActivityAt: record.updatedAt ?? record.createdAt ?? null,
    expiresAt: record.expiresAt,
  };
}

export function getSessionUserHandle(record: SessionStoreItem): number | null {
  const handle = parseSessionPayload(record.payload)?.passport?.user?.handle;
  if (typeof handle === 'number' && Number.isFinite(handle)) return handle;
  if (typeof handle === 'string') {
    const parsedHandle = Number(handle);
    return Number.isFinite(parsedHandle) ? parsedHandle : null;
  }
  return null;
}

function parseSessionPayload(payload: unknown): StoredSessionPayload | null {
  try {
    const parsed =
      typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function maskSessionId(sessionId: string): string {
  const suffix = sessionId.slice(-8);
  return suffix ? `...${suffix}` : '...';
}

export function normalizeRequiredText(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 64) || fallback;
}

export function normalizeNullableText(
  value: unknown,
  fallback: string | null | undefined,
  maxLength: number,
): string | null {
  if (typeof value !== 'string') return fallback ?? null;
  return value.trim().slice(0, maxLength) || null;
}

export function normalizeOptionalText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, maxLength) || undefined;
}

export function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}
