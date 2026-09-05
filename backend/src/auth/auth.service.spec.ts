import { describe, expect, it, jest } from '@jest/globals';
import { AuthService } from './auth.service';

describe('AuthService local login principal', () => {
  it.each([true, false])(
    'preserves the authentication entity when profile loading succeeds: %s',
    async (profileAvailable) => {
      const person = {
        handle: 7,
        loginPassword: 'stored-hash',
        comparePassword: jest.fn(() => true),
      };
      const principal = { handle: 7, roles: [] };
      const service = new AuthService(
        { fork: () => ({ findOne: async () => person }) } as never,
        {
          getPersonWithStarterWorkspace: async () =>
            profileAvailable ? principal : null,
        } as never,
      );

      const login = service.validate('max-mustermann', 'test-password');
      if (profileAvailable) {
        await expect(login).resolves.toBe(principal);
      } else {
        await expect(login).rejects.toThrow('Unauthorized');
      }
      expect(person.loginPassword).toBe('stored-hash');
    },
  );
});

function createApiTokenService(lastUsedAt?: Date) {
  const token = {
    handle: 11,
    expiresAt: new Date(Date.now() + 60_000),
    lastUsedAt,
    allowedIps: [],
    personHandle: 7,
    personIsActive: true,
  };
  const execute = jest.fn((sql: string) =>
    Promise.resolve(sql.trimStart().startsWith('select') ? [token] : []),
  );
  const forkedEntityManager = {
    getConnection: () => ({ execute }),
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

  return { execute, service };
}

describe('AuthService bearer token activity', () => {
  it('persists stale token activity with the forked entity manager', async () => {
    const { execute, service } = createApiTokenService(
      new Date(Date.now() - 10 * 60 * 1000),
    );

    await expect(
      service.validateApiToken('secret', '127.0.0.1'),
    ).resolves.toEqual(expect.objectContaining({ handle: 7 }));

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0]).toContain(
      'update "person_api_token_item"',
    );
  });

  it('does not write token activity again inside the throttle window', async () => {
    const { execute, service } = createApiTokenService(new Date());

    await expect(
      service.validateApiToken('secret', '127.0.0.1'),
    ).resolves.toEqual(expect.objectContaining({ handle: 7 }));

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent stale-token activity writes', async () => {
    const { execute, service } = createApiTokenService(
      new Date(Date.now() - 10 * 60 * 1000),
    );

    await expect(
      Promise.all([
        service.validateApiToken('secret', '127.0.0.1'),
        service.validateApiToken('secret', '127.0.0.1'),
      ]),
    ).resolves.toHaveLength(2);

    const updates = execute.mock.calls.filter(([sql]) =>
      sql.includes('update "person_api_token_item"'),
    );
    expect(updates).toHaveLength(1);
  });
});
