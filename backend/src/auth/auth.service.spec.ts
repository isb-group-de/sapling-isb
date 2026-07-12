import { describe, expect, it, jest } from '@jest/globals';
import { AuthService } from './auth.service';

function createApiTokenService(lastUsedAt?: Date) {
  const token = {
    handle: 11,
    expiresAt: new Date(Date.now() + 60_000),
    lastUsedAt,
    allowedIps: [],
    person: { handle: 7 },
  };
  const forkedEntityManager = {
    findOne: jest.fn<(...args: unknown[]) => Promise<typeof token | null>>(() =>
      Promise.resolve(token),
    ),
    nativeUpdate: jest.fn<(...args: unknown[]) => Promise<number>>(() =>
      Promise.resolve(1),
    ),
  };
  const currentService = {
    getPerson: jest.fn(() =>
      Promise.resolve({ handle: 7, isActive: true, roles: [] }),
    ),
  };
  const service = new AuthService(
    {
      fork: jest.fn(() => forkedEntityManager),
    } as never,
    currentService as never,
  );

  return { forkedEntityManager, service };
}

describe('AuthService bearer token activity', () => {
  it('persists stale token activity with the forked entity manager', async () => {
    const { forkedEntityManager, service } = createApiTokenService(
      new Date(Date.now() - 10 * 60 * 1000),
    );

    await expect(
      service.validateApiToken('secret', '127.0.0.1'),
    ).resolves.toEqual(expect.objectContaining({ handle: 7 }));

    expect(forkedEntityManager.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { handle: 11 },
      { lastUsedAt: expect.any(Date) },
    );
  });

  it('does not write token activity again inside the throttle window', async () => {
    const { forkedEntityManager, service } = createApiTokenService(new Date());

    await expect(
      service.validateApiToken('secret', '127.0.0.1'),
    ).resolves.toEqual(expect.objectContaining({ handle: 7 }));

    expect(forkedEntityManager.nativeUpdate).not.toHaveBeenCalled();
  });
});
