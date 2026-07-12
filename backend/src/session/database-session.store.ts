import { EntityManager } from '@mikro-orm/core';
import session from 'express-session';
import { SessionStoreItem } from '../entity/SessionStoreItem';

type SessionData = session.SessionData;
type SessionErrorCallback = (error?: unknown) => void;
type SessionGetCallback = (
  error: unknown,
  session?: SessionData | null,
) => void;

/**
 * Durable database-backed express-session store.
 */
export class DatabaseSessionStore extends session.Store {
  private readonly knownExpiryBySession = new Map<string, number>();
  private readonly touchIntervalMs: number;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly defaultTtlMs: number,
  ) {
    super();
    this.touchIntervalMs = Math.min(
      5 * 60 * 1000,
      Math.max(1000, Math.floor(defaultTtlMs / 4)),
    );
  }

  override get(sid: string, callback: SessionGetCallback): void {
    void this.runGet(callback, async () => {
      const em = this.entityManager.fork();
      const record = await em.findOne(SessionStoreItem, { handle: sid });

      if (!record) {
        this.knownExpiryBySession.delete(sid);
        return null;
      }

      if (record.expiresAt <= new Date()) {
        this.knownExpiryBySession.delete(sid);
        await em.nativeDelete(SessionStoreItem, { handle: sid });
        return null;
      }

      this.knownExpiryBySession.set(sid, record.expiresAt.getTime());
      return this.deserialize(record.payload);
    });
  }

  override set(
    sid: string,
    sessionData: SessionData,
    callback: SessionErrorCallback = () => undefined,
  ): void {
    void this.run(callback, async () => {
      const em = this.entityManager.fork();
      const record = await em.findOne(SessionStoreItem, { handle: sid });
      const payload = JSON.stringify(sessionData);
      const expiresAt = this.resolveExpiry(sessionData);

      if (record) {
        record.payload = payload;
        record.expiresAt = expiresAt;
      } else {
        em.create(SessionStoreItem, {
          handle: sid,
          payload,
          expiresAt,
        });
      }

      await em.flush();
      this.knownExpiryBySession.set(sid, expiresAt.getTime());
    });
  }

  override touch(
    sid: string,
    sessionData: SessionData,
    callback: SessionErrorCallback = () => undefined,
  ): void {
    void this.run(callback, async () => {
      const expiresAt = this.resolveExpiry(sessionData);
      const knownExpiry = this.knownExpiryBySession.get(sid);

      if (
        typeof knownExpiry === 'number' &&
        expiresAt.getTime() - knownExpiry < this.touchIntervalMs
      ) {
        return;
      }

      const em = this.entityManager.fork();
      const updated = await em.nativeUpdate(
        SessionStoreItem,
        { handle: sid },
        { expiresAt },
      );
      if (updated > 0) {
        this.knownExpiryBySession.set(sid, expiresAt.getTime());
      } else {
        this.knownExpiryBySession.delete(sid);
      }
    });
  }

  override destroy(
    sid: string,
    callback: SessionErrorCallback = () => undefined,
  ): void {
    void this.run(callback, async () => {
      const em = this.entityManager.fork();
      await em.nativeDelete(SessionStoreItem, { handle: sid });
      this.knownExpiryBySession.delete(sid);
    });
  }

  private async run(
    callback: SessionErrorCallback,
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  private async runGet(
    callback: SessionGetCallback,
    operation: () => Promise<SessionData | null>,
  ): Promise<void> {
    try {
      const storedSession = await operation();
      callback(null, storedSession);
    } catch (error) {
      callback(error);
    }
  }

  private resolveExpiry(sessionData: SessionData): Date {
    const expires = sessionData.cookie?.expires;

    if (expires instanceof Date && !Number.isNaN(expires.getTime())) {
      return expires;
    }

    if (typeof expires === 'string') {
      const parsed = new Date(expires);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const maxAge =
      typeof sessionData.cookie?.maxAge === 'number'
        ? sessionData.cookie.maxAge
        : this.defaultTtlMs;

    return new Date(Date.now() + maxAge);
  }

  private deserialize(payload: string): SessionData {
    const parsed = JSON.parse(payload) as SessionData;
    const expires = parsed.cookie?.expires;

    if (typeof expires === 'string') {
      parsed.cookie.expires = new Date(expires);
    }

    return parsed;
  }
}
