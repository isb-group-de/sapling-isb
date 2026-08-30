import { describe, expect, it, jest } from '@jest/globals';
import { DatabaseSessionStore } from './database-session.store';

type MockSessionRecord = {
  handle: string;
  payload: string;
  expiresAt: Date;
};

type MockEntityManager = {
  findOne: jest.Mock<(...args: unknown[]) => Promise<MockSessionRecord | null>>;
  flush: jest.Mock<() => Promise<void>>;
  nativeUpdate: jest.Mock<(...args: unknown[]) => Promise<number>>;
};

function createStore(record: MockSessionRecord | null) {
  const em: MockEntityManager = {
    findOne: jest.fn<(...args: unknown[]) => Promise<MockSessionRecord | null>>(
      () => Promise.resolve(record),
    ),
    flush: jest.fn<() => Promise<void>>(() => Promise.resolve()),
    nativeUpdate: jest.fn<(...args: unknown[]) => Promise<number>>(() =>
      Promise.resolve(record ? 1 : 0),
    ),
  };

  const rootEm = {
    fork: jest.fn(() => em),
  };

  return {
    em,
    store: new DatabaseSessionStore(rootEm as never, 60_000),
  };
}

function touchAsync(
  store: DatabaseSessionStore,
  sid: string,
  sessionData: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    store.touch(sid, sessionData as never, (error?: unknown) => {
      if (error) {
        reject(
          error instanceof Error ? error : new Error('Session touch failed'),
        );
        return;
      }

      resolve();
    });
  });
}

describe('DatabaseSessionStore', () => {
  it('touches expiry without overwriting the stored session payload', async () => {
    const impersonatedPayload = JSON.stringify({
      cookie: { maxAge: 60_000 },
      passport: { user: { handle: 1, impersonatedHandle: 7 } },
    });
    const staleRequestPayload = {
      cookie: { maxAge: 120_000 },
      passport: { user: { handle: 1 } },
    };
    const record: MockSessionRecord = {
      handle: 'session-1',
      payload: impersonatedPayload,
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const { em, store } = createStore(record);

    await touchAsync(store, 'session-1', staleRequestPayload);

    expect(record.payload).toBe(impersonatedPayload);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { handle: 'session-1' },
      expect.objectContaining({
        expiresAt: expect.any(Date),
        personHandle: 1,
        lastSeenAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('skips a database touch while the stored expiry is still fresh', async () => {
    const record: MockSessionRecord = {
      handle: 'session-1',
      payload: JSON.stringify({ cookie: { maxAge: 60_000 } }),
      expiresAt: new Date(Date.now() + 60_000),
    };
    const { em, store } = createStore(record);

    await new Promise<void>((resolve, reject) => {
      store.get('session-1', (error: unknown) =>
        error
          ? reject(
              error instanceof Error
                ? error
                : new Error('Session lookup failed'),
            )
          : resolve(),
      );
    });
    await touchAsync(store, 'session-1', {
      cookie: { maxAge: 60_000 },
    });

    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });
});
